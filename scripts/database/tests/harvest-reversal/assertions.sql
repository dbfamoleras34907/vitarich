begin;
insert into users values(2,auth.uid(),'Harvest','Actor',3,'Broiler',null,'1','actor@example.test');
insert into users_farms values(2,1,'F1','1');
insert into user_permissions(user_id,group_name,title,is_visible,ilink) values
  (auth.uid(),'Menus','Harvest & Delivery/void',true,'/brd/dr/void'),
  (auth.uid(),'Menus','Clean up/void',true,'/brd/cu/void'),
  ('22222222-2222-2222-2222-222222222222','Menus','Harvest & Delivery/view',true,'/brd/dr/view');
create function test_harvest_document(n integer, quantity numeric, state text default 'Posted') returns jsonb language sql as $$
  select test_cleanup_document(n,quantity,state) || jsonb_build_object(
    'id',(select id from br_delivery where gi_no='HARVEST-'||n), 'giNo','HARVEST-'||n,
    'lines',(select jsonb_agg(value || jsonb_build_object('deliveredDate','2026-09-12',
      'allocationGroupKey','HARVEST-GROUP-'||n,'haulerName','Hauler','plateNumber','ABC',
      'destination','Sales','liveSalesCustomerName','Buyer','truckSeal',1))
      from jsonb_array_elements(test_cleanup_document(n,quantity,state)->'lines')));
$$;
create function test_harvest_reverse_error(doc bigint, reason text, expected text) returns void language plpgsql as $$
begin
  begin
    perform reverse_br_delivery_transaction(doc,reason);
    raise exception 'Unexpected reversal success';
  exception when others then if sqlerrm not like expected then raise; end if;
  end;
end;$$;

create function test_harvest_save_error(payload jsonb, expected text) returns void language plpgsql as $$
begin
  begin
    perform save_br_delivery_transaction(payload);
    raise exception 'Unexpected save success';
  exception when others then if sqlerrm not like expected then raise; end if;
  end;
end;$$;
select test_harvest_save_error(test_harvest_document(6,101),'Broiler delivery quantity exceeds%');
select test_assert(not exists(select 1 from br_delivery where gi_no='HARVEST-6'),'failed post rolls back header');
select test_assert(not exists(select 1 from notification_outbox),'failed post emits nothing');

-- Post/Edit hooks remain transactional and identical draft edits deduplicate.
select save_br_delivery_transaction(test_harvest_document(1,50,'Draft'));
select test_assert(not exists(select 1 from notification_outbox),'new draft has no event');
select save_br_delivery_transaction(test_harvest_document(1,60,'Draft'));
select save_br_delivery_transaction(test_harvest_document(1,60,'Draft'));
select test_assert((select count(*)=1 from notification_outbox where event_key='BR_DELIVERY_EDITED'),'identical draft edit emits once');
select test_harvest_reverse_error((select id from br_delivery where gi_no='HARVEST-1'),'test','Only posted%');
select save_br_delivery_transaction(test_harvest_document(1,60));
select test_assert((select count(*)=1 from notification_outbox where event_key='BR_DELIVERY_POSTED'),'post emits once');
select test_harvest_save_error(test_harvest_document(1,60),'Only draft Harvest%');
select test_assert((select count(*)=1 from notification_outbox where event_key='BR_DELIVERY_POSTED'),'rejected posted retry emits nothing extra');
select test_harvest_reverse_error((select id from br_delivery where gi_no='HARVEST-1'),' ','A reversal reason%');
update user_permissions set is_visible=false where user_id=auth.uid() and ilink='/brd/dr/void';
select test_harvest_reverse_error((select id from br_delivery where gi_no='HARVEST-1'),'test','Harvest & Delivery Void permission%');
update user_permissions set is_visible=true where user_id=auth.uid();
update users_farms set void='0' where users_id=2;
select test_harvest_reverse_error((select id from br_delivery where gi_no='HARVEST-1'),'test','Access to the document farm%');
update users_farms set void='1' where users_id=2;
select process_notification_outbox();

-- Draft cleanup and other later stock movements do not block the active cycle.
select save_br_cleanup_transaction(test_cleanup_document(1,40,'Draft'));
insert into inventory_postings(source_doc_type,source_docentry,item_code,warehouse_code,qty,batch_number,transfer_type)
  values('LATER_RECEIPT',1,'DOC','B1',5,'DOC:F1:B1:1','IN');
savepoint late_failure;
create function test_fail_harvest_void() returns trigger language plpgsql as $$begin raise exception 'Injected late failure'; end;$$;
create trigger test_fail_harvest_void after update on br_delivery for each row when(new.status='Cancelled') execute function test_fail_harvest_void();
select test_harvest_reverse_error((select id from br_delivery where gi_no='HARVEST-1'),'test','Injected late failure');
select test_assert((select status='Posted' from br_delivery where gi_no='HARVEST-1'),'late failure preserves harvest');
select test_assert(not exists(select 1 from inventory_postings where delivery_reverses_posting_id is not null),'late failure restores ledger');
select test_assert(not exists(select 1 from notification_outbox where event_key='BR_DELIVERY_VOIDED'),'late failure rolls back event');
rollback to late_failure;
select id as harvest_to_reverse from br_delivery where gi_no='HARVEST-1' \gset
set local role authenticated;
select reverse_br_delivery_transaction(:harvest_to_reverse,'Incorrect harvest');
reset role;
select test_assert((select status='Cancelled' and reversal_reason='Incorrect harvest' and reversed_by=auth.uid() from br_delivery where gi_no='HARVEST-1'),'void audit persisted');
select test_assert((select qty=60 and transfer_type='IN' from inventory_postings where source_doc_type='BR_DELIVERY_REVERSAL' and warehouse_code='B1'),'exact quantity restored');
select test_assert((select sum(case when transfer_type='OUT' then -qty else qty end)=105 from inventory_postings where warehouse_code='B1'),'later movement preserved');
select test_assert((select status='Saved' from flock_card where id=1),'harvest reversal leaves active cycle open');
select reverse_br_delivery_transaction(:harvest_to_reverse,'Retry');
select test_assert((select count(*)=1 from inventory_postings where source_doc_type='BR_DELIVERY_REVERSAL'),'retry ledger unique');
select test_assert((select count(*)=1 from notification_outbox where event_key='BR_DELIVERY_VOIDED'),'retry event unique');
select process_notification_outbox();
select test_assert((select status='processed' from notification_outbox where event_key='BR_DELIVERY_VOIDED'),'no-rule dispatch is safe');
select test_assert(not exists(select 1 from user_notifications),'no-rule creates no deliveries');
insert into notification_rules(module_key,event_key,name,require_view_permission) values('BR_DELIVERY','BR_DELIVERY_VOIDED','Harvest reversed',true);
update notification_outbox set status='pending' where event_key='BR_DELIVERY_VOIDED';
select process_notification_outbox();
select test_assert((select count(*)=1 from user_notifications),'farm and permission matched recipient');
update notification_outbox set status='pending' where event_key='BR_DELIVERY_VOIDED';
select process_notification_outbox();
select test_assert((select count(*)=1 from user_notifications),'recipient retry unique');
update notification_outbox set status='pending',farm_id=null where event_key='BR_DELIVERY_VOIDED';
select process_notification_outbox();
select test_assert((select status='invalid' from notification_outbox where event_key='BR_DELIVERY_VOIDED'),'missing farm cannot deliver globally');

-- Full harvest -> zero cleanup blocks -> reversed cleanup permits harvest reversal.
delete from flock_card_origin where fc_id=2;
select save_br_delivery_transaction(test_harvest_document(2,100));
select save_br_cleanup_transaction(test_cleanup_document(2,0));
select test_harvest_reverse_error((select id from br_delivery where gi_no='HARVEST-2'),'test','Posted Clean Up exists%');
select reverse_br_cleanup_transaction((select id from br_cleanup where gi_no='CU-TEST-2'),'Reverse cleanup first');
select reverse_br_delivery_transaction((select id from br_delivery where gi_no='HARVEST-2'),'Reverse harvest after cleanup');
select test_assert((select sum(case when transfer_type='OUT' then -qty else qty end)=100 from inventory_postings where warehouse_code='B2'),'voided cleanup does not block stock restoration');

-- Old/closed cycle cannot qualify even without a posted cleanup.
select save_br_delivery_transaction(test_harvest_document(3,20));
savepoint old_cycle;
update flock_card set status='Closed' where id=3;
insert into flock_card(id,farm_id,building_whse_id,building_code,cycle_no,start_date,status,void)
  values(99,1,3,'B3','2','2026-09-13','Saved','1');
select test_harvest_reverse_error((select id from br_delivery where gi_no='HARVEST-3'),'test','Only harvests in the current active cycle%');
rollback to old_cycle;

-- Multi-building harvest is all-or-nothing when one building has posted cleanup.
select save_br_delivery_transaction(jsonb_set(test_harvest_document(4,50),'{lines}',
  (test_harvest_document(4,50)->'lines') || (test_harvest_document(5,60)->'lines')));
savepoint multi_cleanup;
select save_br_cleanup_transaction(test_cleanup_document(5,40));
select test_harvest_reverse_error((select id from br_delivery where gi_no='HARVEST-4'),'test','Posted Clean Up exists%');
select test_assert(not exists(select 1 from inventory_postings where source_doc_type='BR_DELIVERY_REVERSAL' and warehouse_code in ('B4','B5')),'blocked multi-building harvest reverses neither building');
rollback to multi_cleanup;
select reverse_br_delivery_transaction((select id from br_delivery where gi_no='HARVEST-4'),'Reverse both buildings');
select test_assert((select sum(qty)=110 from inventory_postings where source_doc_type='BR_DELIVERY_REVERSAL' and warehouse_code in ('B4','B5')),'all original allocations restored');
-- Reported case: the next cycle's origins reference the previous canonical batch.
-- The previous Posted cleanup must not be treated as cleanup of the new cycle.
select save_br_cleanup_transaction(test_cleanup_document(7,90));
insert into flock_card(id,card_no,farm_id,building_whse_id,building_code,building_name,cycle_no,start_date,status,void)
  values(100,'FC7-C2',1,7,'B7','Building 7','2','2026-09-10','Saved','1');
insert into flock_card_origin values(100,'DOC','DOC:F1:B7:1','1');
insert into brd_fc(id,card_no,farm_id,void,actual_age) values(100,'FC7-C2',1,'1',40);
insert into brd_fc_line(fc_id,age,mort_am,mort_pm,void) values(100,40,1,0,'1');
insert into inventory_postings(source_doc_type,source_docentry,item_code,warehouse_code,qty,batch_number,transfer_type)
  values('DOC_RECEIVING_CONSOLIDATION',100,'DOC','B7',100,'DOC:F1:B7:2','IN');
select save_br_delivery_transaction(jsonb_set(test_harvest_document(7,60),'{lines,0,batchNumber}','"DOC:F1:B7:2"'));
select save_br_cleanup_transaction(jsonb_set(test_cleanup_document(7,40),'{lines,0,batchNumber}','"DOC:F1:B7:2"') || jsonb_build_object('giNo','CU-NEW-7'));
select test_harvest_reverse_error((select id from br_delivery where gi_no='HARVEST-7'),'test','Posted Clean Up exists%');
select reverse_br_cleanup_transaction((select id from br_cleanup where gi_no='CU-NEW-7'),'Void cycle 2 cleanup');
select reverse_br_delivery_transaction((select id from br_delivery where gi_no='HARVEST-7'),'Reverse cycle 2 harvest');
select test_assert((select status='Posted' from br_cleanup where gi_no='CU-TEST-7'),'cycle 1 cleanup stays Posted');
select test_assert((select status='Cancelled' from br_delivery where gi_no='HARVEST-7'),'cycle 2 harvest reverses despite carried origin');
rollback;
