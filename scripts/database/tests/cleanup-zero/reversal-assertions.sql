begin;
insert into users values(2,auth.uid(),'Cleanup','Actor',3,'Broiler',null,'1','actor@example.test');
insert into users_farms values(2,1,'F1','1');
insert into user_permissions(user_id,group_name,title,is_visible,ilink) values(auth.uid(),'Menus','Clean up/void',true,'/brd/cu/void');
create function test_reverse_error(doc bigint, reason text, expected text) returns void language plpgsql as $$
begin
  begin
    perform reverse_br_cleanup_transaction(doc,reason);
    raise exception 'Unexpected reversal success';
  exception when others then
    if sqlerrm not like expected then raise; end if;
  end;
end;$$;
select save_br_cleanup_transaction(test_cleanup_document(1,90));
select save_br_cleanup_transaction(test_cleanup_document(2,90,'Draft'));
select test_reverse_error((select id from br_cleanup where gi_no='CU-TEST-2'),'test','Only posted%');
select test_reverse_error((select id from br_cleanup where gi_no='CU-TEST-1'),' ','A reversal reason%');
update user_permissions set is_visible=false where user_id=auth.uid();
select test_reverse_error((select id from br_cleanup where gi_no='CU-TEST-1'),'test','Clean Up Void permission%');
update user_permissions set is_visible=true where user_id=auth.uid();
update users_farms set void='0' where users_id=2;
select test_reverse_error((select id from br_cleanup where gi_no='CU-TEST-1'),'test','Access to the document farm%');
update users_farms set void='1' where users_id=2;

savepoint dependencies;
insert into flock_card(id, farm_id, building_whse_id, building_code, start_date, status, void) values(100,1,1,'B1','2026-09-13','Saved','1');
select test_reverse_error((select id from br_cleanup where gi_no='CU-TEST-1'),'test','A newer cycle%');
rollback to dependencies;
insert into inventory_postings(source_doc_type,source_docentry,item_code,warehouse_code,qty,batch_number,transfer_type) values('OTHER',99,'DOC','B1',0,'OTHER','IN');
select test_reverse_error((select id from br_cleanup where gi_no='CU-TEST-1'),'test','A subsequent transaction%');
rollback to dependencies;
update br_delivery set status='Draft', from_warehouse_id=1, created_at=now()+interval '1 second' where id=1;
select test_reverse_error((select id from br_cleanup where gi_no='CU-TEST-1'),'test','A subsequent transaction%');
rollback to dependencies;
insert into br_delivery_lines values(1,1,'B1','1',now()+interval '1 second',null);
select test_reverse_error((select id from br_cleanup where gi_no='CU-TEST-1'),'test','A subsequent transaction%');
rollback to dependencies;
update brd_fc set updated_at=now()+interval '1 second' where id=1;
select test_reverse_error((select id from br_cleanup where gi_no='CU-TEST-1'),'test','A subsequent transaction%');
rollback to dependencies;
insert into goods_receipt_doc values(1,1,'1',now()+interval '1 second',null);
select test_reverse_error((select id from br_cleanup where gi_no='CU-TEST-1'),'test','A subsequent transaction%');
rollback to dependencies;
insert into doc_farm_cycles values(1,1,1,'Closed',now(),null,null),(2,1,2,'Saved',null,null,null);
update flock_card set farm_cycle_id=1 where id=1;
select test_reverse_error((select id from br_cleanup where gi_no='CU-TEST-1'),'test','The farm cycle cannot%');
rollback to dependencies;
select test_assert(not exists(select 1 from inventory_postings where cleanup_reverses_posting_id is not null),'failed reversals produce no ledger rows');
select test_assert(not exists(select 1 from notification_outbox where event_key='BR_CLEANUP_VOIDED'),'failed reversals produce no events');

-- Force failure after inventory restoration/cycle updates to prove full rollback.
savepoint late_failure;
create function test_fail_cleanup_void() returns trigger language plpgsql as $$begin raise exception 'Injected late failure'; end;$$;
create trigger test_fail_cleanup_void after update on br_cleanup for each row when (new.status='Cancelled') execute function test_fail_cleanup_void();
select test_reverse_error((select id from br_cleanup where gi_no='CU-TEST-1'),'test','Injected late failure');
select test_assert((select status='Posted' from br_cleanup where gi_no='CU-TEST-1'),'late failure preserves posted document');
select test_assert((select status='Closed' from flock_card where id=1),'late failure preserves closed cycle');
select test_assert(not exists(select 1 from inventory_postings where cleanup_reverses_posting_id is not null),'late failure rolls back reversal ledger');
select test_assert(not exists(select 1 from notification_outbox where event_key='BR_CLEANUP_VOIDED'),'late failure rolls back outbox');
rollback to late_failure;

insert into doc_farm_cycles values(1,1,1,'Closed',now(),null,null);
update flock_card set farm_cycle_id=1 where id=1;
select process_notification_outbox();
select id as cleanup_to_reverse from br_cleanup where gi_no='CU-TEST-1' \gset
set local role authenticated;
select reverse_br_cleanup_transaction(:cleanup_to_reverse,'Wrong cleanup');
reset role;
select test_assert((select status='Cancelled' and reversal_reason='Wrong cleanup' and reversed_by=auth.uid() from br_cleanup where gi_no='CU-TEST-1'),'void status and audit persisted');
select test_assert((select sum(qty)=90 from inventory_postings where source_doc_type='BR_CLEANUP_REVERSAL'),'cleanup quantity restored');
select test_assert((select sum(qty)=10 from inventory_postings where source_doc_type='BR_CLEANUP_VARIANCE_REVERSAL'),'variance restored');
select test_assert((select status='Saved' and not extra ? 'closed_by_docentry' from flock_card where id=1),'building cycle reopened');
select test_assert((select status='Saved' and closed_at is null from doc_farm_cycles where id=1),'farm cycle reopened');
select reverse_br_cleanup_transaction((select id from br_cleanup where gi_no='CU-TEST-1'),'Retry');
select test_assert((select count(*)=2 from inventory_postings where cleanup_reverses_posting_id is not null),'retry does not duplicate ledger');
select test_assert((select count(*)=1 from notification_outbox where event_key='BR_CLEANUP_VOIDED'),'retry does not duplicate void event');
select process_notification_outbox();
select test_assert((select status='processed' from notification_outbox where event_key='BR_CLEANUP_VOIDED'),'no-rule void dispatch safe');
select test_assert(not exists(select 1 from user_notifications),'no rule produces no delivery');
insert into notification_rules(module_key,event_key,name,require_view_permission) values('BR_CLEANUP','BR_CLEANUP_VOIDED','Void test',true);
update notification_outbox set status='pending' where event_key='BR_CLEANUP_VOIDED';
select process_notification_outbox();
select test_assert((select count(*)=1 from user_notifications),'farm and view matched void delivered');
update notification_outbox set status='pending' where event_key='BR_CLEANUP_VOIDED';
select process_notification_outbox();
select test_assert((select count(*)=1 from user_notifications),'recipient retry deduplicates');
update notification_outbox set status='pending',farm_id=null where event_key='BR_CLEANUP_VOIDED';
select process_notification_outbox();
select test_assert((select status='invalid' from notification_outbox where event_key='BR_CLEANUP_VOIDED'),'missing farm cannot become global');

-- Zero cleanup still has an exact, zero-quantity reversal and reopens the cycle.
insert into inventory_postings(source_doc_type,source_docentry,item_code,warehouse_code,qty,batch_number,transfer_type) values('BR_DELIVERY',3,'DOC','B3',100,'DOC:F1:B3:1','OUT');
select save_br_cleanup_transaction(test_cleanup_document(3,0));
select reverse_br_cleanup_transaction((select id from br_cleanup where gi_no='CU-TEST-3'),'Zero closeout reversal');
select test_assert((select qty=0 and transfer_type='IN' from inventory_postings where source_doc_type='BR_CLEANUP_REVERSAL' and warehouse_code='B3'),'zero posting reversed');
select test_assert((select status='Saved' from flock_card where id=3),'zero cycle reopened');

-- A multi-building document must reverse all buildings together or none.
select save_br_cleanup_transaction(jsonb_set(test_cleanup_document(4,90),'{lines}',
  (test_cleanup_document(4,90)->'lines') || (test_cleanup_document(5,80)->'lines')));
savepoint multi_block;
insert into inventory_postings(source_doc_type,source_docentry,item_code,warehouse_code,qty,batch_number,transfer_type) values('OTHER',99,'DOC','B5',1,'NEW','IN');
select test_reverse_error((select id from br_cleanup where gi_no='CU-TEST-4'),'test','A subsequent transaction%');
select test_assert((select bool_and(status='Closed') from flock_card where id in (4,5)),'multi-building failure preserves both closed cycles');
rollback to multi_block;
select reverse_br_cleanup_transaction((select id from br_cleanup where gi_no='CU-TEST-4'),'Reverse both buildings');
select test_assert((select bool_and(status='Saved') from flock_card where id in (4,5)),'all selected building cycles reopen');
select test_assert((select sum(qty)=200 from inventory_postings where source_doc_type in ('BR_CLEANUP_REVERSAL','BR_CLEANUP_VARIANCE_REVERSAL') and warehouse_code in ('B4','B5')),'all building quantities and variance restored');
rollback;
