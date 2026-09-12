begin;
-- Reported Building 1 shape: DOC Receiving wrote the consolidated ledger but
-- the active flock card has no flock_card_origin rows. Include the rejection
-- cases too, so absent origins cannot turn unqualified zero balances eligible.
delete from flock_card_origin where fc_id in (1, 2, 3, 4, 5, 6, 7, 11);
-- Harvest empties the canonical consolidated batch.
-- Match the supplied warehouse report: 71,774 received, 3,483 net mortality,
-- and the final harvest of 68,291 leaves zero.
update inventory_postings set qty = 71774 where warehouse_code = 'B1';
insert into inventory_postings(source_doc_type,source_docentry,item_code,warehouse_code,qty,batch_number,transfer_type)
  values('BRD_FC_MORT_THIN_TRANSFER_OUT',1,'DOC','B1',3483,'DOC:F1:B1:1','OUT');
insert into inventory_postings(source_doc_type,source_docentry,item_code,warehouse_code,qty,batch_number,transfer_type)
  values('BR_DELIVERY',1,'DOC','B1',68291,'DOC:F1:B1:1','OUT');
select test_assert((select count(*) = 1 from get_harvest_emptied_cleanup_batches(1)), 'harvest-emptied cycle eligible');
select save_br_cleanup_transaction(test_cleanup_document(1,0));
select test_assert((select status = 'Closed' from flock_card where id = 1), 'zero cleanup closes cycle');
select test_assert((select count(*) = 1 and min(qty) = 0 from inventory_postings where source_doc_type = 'BR_CLEANUP' and warehouse_code = 'B1'), 'zero cleanup records one zero-quantity inventory posting');
select test_assert(not exists(select 1 from inventory_postings where source_doc_type = 'BR_CLEANUP_VARIANCE'), 'zero cleanup creates no variance');
select test_assert((select farm_code = 'F1' from br_cleanup where gi_no = 'CU-TEST-1'), 'farm code resolved from canonical row');
select save_br_cleanup_transaction(test_cleanup_document(1,0));
select test_assert((select count(*) = 1 from notification_outbox), 'identical post retry produces one event');
select test_assert((select count(*) = 1 from inventory_postings where source_doc_type = 'BR_CLEANUP' and warehouse_code = 'B1'), 'identical post retry does not duplicate zero inventory posting');
select process_notification_outbox();
select test_assert((select bool_and(status = 'processed') from notification_outbox), 'no-rule dispatch succeeds');
select test_assert(not exists(select 1 from user_notifications), 'no active rule produces no delivery');

-- Empty due to mortality, unposted harvest, wrong-farm harvest, or residual/negative balance.
insert into inventory_postings(source_doc_type,source_docentry,item_code,warehouse_code,qty,batch_number,transfer_type)
values ('BRD_FC',2,'DOC','B2',100,'DOC:F1:B2:1','OUT'),
       ('BR_DELIVERY',3,'DOC','B3',100,'DOC:F1:B3:1','OUT'),
       ('BR_DELIVERY',4,'DOC','B4',100,'DOC:F1:B4:1','OUT'),
       ('BR_DELIVERY',5,'DOC','B5',99,'DOC:F1:B5:1','OUT'),
       ('BR_DELIVERY',6,'DOC','B6',101,'DOC:F1:B6:1','OUT'),
       ('BR_DELIVERY',7,'DOC','B7',99,'DOC:F1:B7:1','OUT'),
       ('BRD_FC',7,'DOC','B7',1,'DOC:F1:B7:1','OUT');
update br_delivery set status = 'Draft' where id = 3;
update br_delivery set farm_id = 2 where id = 4;
do $$begin
  for n in 2..7 loop
    perform test_assert(not exists(select 1 from get_harvest_emptied_cleanup_batches(n)), 'ineligible zero cleanup '||n);
    begin
      perform save_br_cleanup_transaction(test_cleanup_document(n,0));
      raise exception 'Unexpected successful zero cleanup %',n;
    exception when others then
      if sqlerrm not like 'Zero-quantity Clean Up requires%' then raise; end if;
    end;
    perform test_assert(not exists(select 1 from br_cleanup where gi_no = 'CU-TEST-'||n), 'failed post rolls back header');
    perform test_assert((select status = 'Saved' from flock_card where id = n), 'failed post keeps cycle active');
  end loop;
end;$$;
select test_assert((select count(*) = 1 from notification_outbox), 'failed operations emit nothing');

-- Harvest from before the current cycle and a forged line batch cannot qualify.
insert into inventory_postings(source_doc_type,source_docentry,item_code,warehouse_code,qty,batch_number,transfer_type)
values ('BR_DELIVERY',12,'DOC','B12',100,'DOC:F1:B12:1','OUT');
update br_delivery set issue_date = '2026-07-01' where id = 12;
select test_assert(not exists(select 1 from get_harvest_emptied_cleanup_batches(12)), 'old-cycle harvest excluded');
update br_delivery set issue_date = '2026-09-01' where id = 12;
do $$begin
  begin
    perform save_br_cleanup_transaction(jsonb_set(test_cleanup_document(12,0),'{lines,0,batchNumber}','"OTHER-CYCLE"'));
    raise exception 'Unexpected forged batch acceptance';
  exception when others then
    if sqlerrm not like 'Zero-quantity Clean Up requires%' then raise; end if;
  end;
end;$$;

-- Existing positive cleanup/variance behavior stays intact. Draft edits emit once.
select save_br_cleanup_transaction(test_cleanup_document(8,90,'Draft'));
select save_br_cleanup_transaction(test_cleanup_document(8,80,'Draft'));
select save_br_cleanup_transaction(test_cleanup_document(8,80,'Draft'));
select test_assert((select count(*) = 1 from notification_outbox where event_key = 'BR_CLEANUP_EDITED'), 'one event for identical draft edit retries');
select save_br_cleanup_transaction(test_cleanup_document(8,80));
select test_assert((select sum(qty) = 80 from inventory_postings where source_doc_type = 'BR_CLEANUP' and warehouse_code = 'B8'), 'positive cleanup posting preserved');
select test_assert((select sum(qty) = 20 from inventory_postings where source_doc_type = 'BR_CLEANUP_VARIANCE' and warehouse_code = 'B8'), 'positive cleanup variance preserved');

-- An edit that fails later rolls back header, lines, inventory and event.
select save_br_cleanup_transaction(test_cleanup_document(9,90,'Draft'));
do $$begin
  begin
    perform save_br_cleanup_transaction(test_cleanup_document(9,101));
    raise exception 'Unexpected successful over-issue';
  exception when others then
    if sqlerrm not like 'Clean up balance mismatch%' then raise; end if;
  end;
  perform test_assert((select line.base_qty = 90 from br_cleanup_lines line join br_cleanup header on header.id = line.br_cleanup_id where header.gi_no = 'CU-TEST-9' and line.void = '1'), 'failed edit preserves draft lines');
end;$$;

-- Legacy, unconsolidated batches use the same harvest evidence.
update inventory_postings set batch_number = 'ORIGIN10', source_doc_type = 'DOC_RECEIVING' where warehouse_code = 'B10';
insert into inventory_postings(source_doc_type,source_docentry,item_code,warehouse_code,qty,batch_number,transfer_type)
values ('BR_DELIVERY',10,'DOC','B10',100,'ORIGIN10','OUT');
select test_assert((select batch_number = 'ORIGIN10' from get_harvest_emptied_cleanup_batches(10)), 'legacy batch eligible');
select save_br_cleanup_transaction(jsonb_set(test_cleanup_document(10,0),'{lines,0,batchNumber}','"ORIGIN10"'));

-- Harvest-emptied closeout is allowed without eligible mortality age.
insert into inventory_postings(source_doc_type,source_docentry,item_code,warehouse_code,qty,batch_number,transfer_type)
values ('BR_DELIVERY',11,'DOC','B11',100,'DOC:F1:B11:1','OUT');
insert into brd_cu_settings(farm_id,target_cleanup_age) values(1,41);
delete from brd_fc_line where fc_id = 11;
select save_br_cleanup_transaction(test_cleanup_document(11,0));
select test_assert((select status = 'Closed' from flock_card where id = 11), 'zero harvest closes cycle without mortality age');
select test_assert((select qty = 0 from inventory_postings where source_doc_type = 'BR_CLEANUP' and warehouse_code = 'B11'), 'no-age closeout records zero inventory posting');
-- Positive cleanup still obeys the configured age requirement.
do $$begin
  begin
    perform save_br_cleanup_transaction(test_cleanup_document(9,90));
    raise exception 'Unexpected age bypass';
  exception when others then
    if sqlerrm not like '%mortality age for Clean up%' then raise; end if;
  end;
end;$$;
delete from brd_cu_settings;

-- Dispatcher validates persisted farms before matching rules; retries are unique.
insert into notification_rules(module_key,event_key,name,require_view_permission)
values('BR_CLEANUP','BR_CLEANUP_POSTED','Cleanup test',true);
select process_notification_outbox();
select test_assert(not exists(select 1 from notification_outbox where status = 'failed'), 'shared dispatcher completes');
select test_assert((select count(*) = 3 from user_notifications), 'only matching posted events delivered');
update notification_outbox set status = 'pending';
select process_notification_outbox();
select test_assert((select count(*) = 4 from user_notifications), 'reprocessing adds formerly unmatched first post only');
update notification_outbox set status = 'pending';
select process_notification_outbox();
select test_assert((select count(*) = 4 from user_notifications), 'recipient retries deduplicate');
update notification_outbox set farm_id = null, recipient_farm_id = null, status = 'pending' where document_no = 'CU-TEST-1';
select process_notification_outbox();
select test_assert((select status = 'invalid' from notification_outbox where document_no = 'CU-TEST-1'), 'missing required farm invalid, never global');
rollback;
