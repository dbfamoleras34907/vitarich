\set ON_ERROR_STOP on
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
-- Preserve ids from source fixtures when exercising identity inserts.
select setval(pg_get_serial_sequence('dispatch_doc','id'),1000);
select setval(pg_get_serial_sequence('dispatch_doc_item','id'),1000);
select setval(pg_get_serial_sequence('tbl_brd_dispatch','id'),1000);
select setval(pg_get_serial_sequence('tbl_brd_dispatch_line','id'),1000);
create function public.test_dispatch_payload(q numeric,remarks text default 'Original') returns jsonb language sql as $$
select jsonb_build_object('doc_date','2026-09-01','dr_no','ATOMIC-DISPATCH','destination_farm_code','BR-TEST','remarks',remarks,
  'items',jsonb_build_array(jsonb_build_object('doc_batch_code','TEST-BATCH','sku_name','Good DOC','classification','SALEABLE','uom','BOX','qty',q))) $$;
set role service_role;
select public.save_hatchery_dispatch_transaction(null,public.test_dispatch_payload(10),'00000000-0000-0000-0000-000000000001');
reset role;
do $$ declare n integer; begin
  select count(*) into n from public.notification_outbox;
  begin perform public.save_hatchery_dispatch_transaction(1001,public.test_dispatch_payload(-1,'Must roll back'),auth.uid()); raise exception 'Bad dispatch accepted'; exception when check_violation then null; end;
  if (select remarks from public.dispatch_doc where id=1001)<>'Original' then raise exception 'Failed source save changed its header'; end if;
  if (select qty from public.dispatch_doc_item where dispatch_doc_id=1001)<>10 then raise exception 'Failed source save deleted its old lines'; end if;
  if (select count(*) from public.notification_outbox)<>n then raise exception 'Failed source save emitted event'; end if;
end $$;
select public.save_hatchery_dispatch_transaction(1001,public.test_dispatch_payload(11,'Edited'),auth.uid());
select public.save_hatchery_dispatch_transaction(1001,public.test_dispatch_payload(11,'Edited'),auth.uid());
do $$ begin if (select count(*) from public.notification_outbox where module_key='HATCHERY_DOC_DISPATCH' and entity_id='1001' and event_key='HATCHERY_DOC_DISPATCH_EDITED')<>1 then raise exception 'Source edit retry duplicated event'; end if; end $$;
update public.dispatch_doc set is_active=false where id=1001;
update public.dispatch_doc set is_active=false where id=1001;
do $$ begin if (select count(*) from public.notification_outbox where module_key='HATCHERY_DOC_DISPATCH' and entity_id='1001' and event_key='HATCHERY_DOC_DISPATCH_VOIDED')<>1 then raise exception 'Repeated Void duplicated event'; end if; end $$;
select 'Source draft transaction assertions passed' as result;

-- A legacy draft without event state must emit Post when first posted.
select public.save_hatchery_dispatch_transaction(null,public.test_dispatch_payload(12,'Legacy draft'),auth.uid());
delete from public.receiving_flow_event_state where module_key='HATCHERY_DOC_DISPATCH' and entity_id=1002;
update public.dispatch_doc set status='Posted' where id=1002;
do $$ begin
  if not exists(select 1 from public.notification_outbox where module_key='HATCHERY_DOC_DISPATCH' and entity_id='1002' and event_key='HATCHERY_DOC_DISPATCH_POSTED') then raise exception 'Legacy draft posting did not emit Post'; end if;
end $$;

-- No configured series: retain the stock-in fallback, with fresh receipt numbers.
begin;
update public.batch_rules set active=false;
do $$ declare a text; b text; begin
  a:=public.receiving_new_batch('hatchery',100,'FALLBACK-1','EGG-TEST','2026-09-01',null);
  b:=public.receiving_new_batch('hatchery',100,'FALLBACK-2','EGG-TEST','2026-09-01',null);
  if a not like 'FD-260901-%' or a=b then raise exception 'Fallback batch template or unique allocation failed'; end if;
end $$;
rollback;
