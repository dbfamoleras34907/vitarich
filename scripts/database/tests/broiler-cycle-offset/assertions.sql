-- Disposable PostgreSQL only:
-- createdb -h 127.0.0.1 -p <port> -U postgres codex_broiler_offset_test
-- psql -h 127.0.0.1 -p <port> -U postgres -d codex_broiler_offset_test -f <this file>
\set ON_ERROR_STOP on
do $$ begin
  if current_database() <> 'codex_broiler_offset_test'
    or inet_server_addr() <> '127.0.0.1'::inet then
    raise exception 'This fixture is only for a disposable local test database.';
  end if;
end $$;
create role anon;
create role authenticated;
create role service_role;
create role authenticator;
create table public.farms(id bigint primary key);
create table public.doc_farm_cycles(
  id bigint primary key, farm_id bigint references farms(id), cycle_no bigint check(cycle_no > 0),
  status text, unique(farm_id, cycle_no)
);
create table public.flock_card(
  id bigint primary key, farm_id bigint references farms(id), building_whse_id bigint,
  cycle_no text, farm_cycle_id bigint references doc_farm_cycles(id), status text, void text
);
create table public.inventory_postings(
  id bigint primary key, batch_number text, ref text, ref2 text, qty numeric,
  reverses_posting_id bigint references inventory_postings(id)
);
create table public.brd_fc_line(id bigint primary key, extra jsonb);
create table public.vnm_documents(
  id bigint primary key, farm_id bigint, farm_cycle_id bigint, cycle_no bigint, fms_type text
);
create table public.item_batches(id bigint primary key, batch_number text unique);
create table public.br_delivery_lines(id bigint primary key, batch_number text);
create table public.br_cleanup_lines(id bigint primary key, batch_number text);
create table public.flock_card_origin(id bigint primary key, batch_no text);
create table public.brd_fc_ba(id bigint primary key, batch_no text);
create table public.goods_receipt_items(id bigint primary key, batch_number text);
create table public.goods_issue_items(id bigint primary key, batch_number text);
create table public.inventory_transfer_items(id bigint primary key, batch_number text);
create table public.vnm_line_batches(id bigint primary key, batch_number text);
\ir ../../offset-broiler-cycles-1000.sql

insert into farms values (1),(2);
insert into doc_farm_cycles values (1,1,1,'Closed'),(2,1,1001,'Saved');
insert into flock_card values
  (1,1,10,'1',1,'Closed','0'), (2,1,10,'1001',2,'Saved','1'),
  (3,2,20,'7',null,'Saved','1'), (4,2,21,null,null,'Cancelled','0');
insert into inventory_postings values
  (1,'DOC:F1:B10:1','DOC:F1:B10:1',null,12,null),
  (2,'DOC:F1:B10:1','DOC:F1:B10:1',null,12,1),
  (3,'DOC:F1:B10:1001','DOC:F1:B10:1001','DOC:F2:B20:7',9,null),
  (4,'SUPPLIER-001','SUPPLIER-001',null,20,null);
insert into brd_fc_line values (1,'{"mortalityBatchAllocations":[{"batchNumber":"DOC:F1:B10:1","qty":12},{"batchNumber":"DOC:F1:B10:1001","qty":9}],"other":"keep"}');
insert into vnm_documents values (1,1,1,1,'Broiler'),(2,2,null,5,'Breeder');
insert into item_batches values (1,'DOC:F1:B10:1'),(2,'DOC:F1:B10:1001');
insert into br_delivery_lines values (1,'DOC:F1:B10:1');
insert into br_cleanup_lines values (1,'DOC:F1:B10:1');
insert into flock_card_origin values (1,'DOC:F1:B10:1');
insert into brd_fc_ba values (1,'DOC:F1:B10:1');
insert into goods_receipt_items values (1,'DOC:F1:B10:1');
insert into goods_issue_items values (1,'DOC:F1:B10:1');
insert into inventory_transfer_items values (1,'DOC:F1:B10:1');
insert into vnm_line_batches values (1,'DOC:F1:B10:1');

-- These model posting/active-cycle triggers that must never run for a rename.
create function public.reject_reposting() returns trigger language plpgsql as $$
begin raise exception 'Unexpected business trigger fired'; end $$;
create trigger test_origin before update on flock_card_origin for each row execute function reject_reposting();
create trigger test_cycle before update on flock_card for each row execute function reject_reposting();
create trigger test_always before update on inventory_postings for each row execute function reject_reposting();
alter table inventory_postings enable always trigger test_always;
create trigger test_replica before update on inventory_postings for each row execute function reject_reposting();
alter table inventory_postings enable replica trigger test_replica;
create trigger test_disabled before update on inventory_postings for each row execute function reject_reposting();
alter table inventory_postings disable trigger test_disabled;

do $$ declare r jsonb; begin
  r := offset_broiler_cycles_1000();
  assert r->>'applied' = 'false';
  assert (r->>'flockCards')::int = 3;
  assert (select cycle_no from doc_farm_cycles where id=1) = 1;
  assert not exists(select 1 from broiler_cycle_offset_audit);
  assert offset_broiler_cycles_1000() = r, 'Repeated preview changed';
end $$;

-- Validation failures leave every cycle intact.
begin;
insert into flock_card values (5,1,30,'ABC',null,'Saved','1');
do $$ begin
  begin perform offset_broiler_cycles_1000(true); raise exception 'Expected failure';
  exception when others then if sqlerrm not like 'Non-numeric%' then raise; end if; end;
  assert (select cycle_no from doc_farm_cycles where id=1)=1;
end $$;
rollback;
begin;
insert into inventory_postings values (5,'DOC:F99:B99:1',null,null,5,null);
do $$ begin
  begin perform offset_broiler_cycles_1000(true); raise exception 'Expected failure';
  exception when others then if sqlerrm not like 'Unmapped DOC%' then raise; end if; end;
end $$;
rollback;

-- A late constraint failure rolls back cycle changes AND suspended triggers.
begin;
alter table br_delivery_lines add constraint test_late_failure check(batch_number <> 'DOC:F1:B10:1001');
do $$ begin
  begin perform offset_broiler_cycles_1000(true); raise exception 'Expected failure';
  exception when check_violation then null; end;
  assert (select cycle_no from doc_farm_cycles where id=1)=1;
  assert (select tgenabled from pg_trigger where tgname='test_cycle')='O';
  assert not exists(select 1 from broiler_cycle_offset_audit);
end $$;
rollback;

do $$ declare r jsonb; begin
  r := offset_broiler_cycles_1000(true);
  assert r->>'applied' = 'true';
  assert (select cycle_no from doc_farm_cycles where id=1)=1001;
  assert (select cycle_no from doc_farm_cycles where id=2)=2001;
  assert (select max(cycle_no)+1 from doc_farm_cycles where farm_id=1)=2002;
  assert (select cycle_no from flock_card where id=3)='1007';
  assert (select cycle_no from flock_card where id=4) is null;
  assert (select cycle_no from vnm_documents where id=1)=1001;
  assert (select cycle_no from vnm_documents where id=2)=5;
  assert (select batch_number from item_batches where id=1)='DOC:F1:B10:1001';
  assert (select batch_number from item_batches where id=2)='DOC:F1:B10:2001';
  assert (select ref2 from inventory_postings where id=3)='DOC:F2:B20:1007';
  assert (select batch_number from inventory_postings where id=4)='SUPPLIER-001';
  assert (select count(*) from inventory_postings)=4;
  assert (select sum(qty) from inventory_postings)=53;
  assert not exists(select 1 from inventory_postings r join inventory_postings s
    on s.id=r.reverses_posting_id where r.ref is distinct from s.ref or r.qty<>s.qty);
  assert (select extra #>> '{mortalityBatchAllocations,0,batchNumber}' from brd_fc_line)='DOC:F1:B10:1001';
  assert (select extra #>> '{mortalityBatchAllocations,1,batchNumber}' from brd_fc_line)='DOC:F1:B10:2001';
  assert (select extra->>'other' from brd_fc_line)='keep';
  assert (select tgenabled from pg_trigger where tgname='test_cycle')='O';
  assert (select tgenabled from pg_trigger where tgname='test_always')='A';
  assert (select tgenabled from pg_trigger where tgname='test_replica')='R';
  assert (select tgenabled from pg_trigger where tgname='test_disabled')='D';
  assert not has_function_privilege('authenticated','public.offset_broiler_cycles_1000(boolean)','EXECUTE');
  assert not has_function_privilege('service_role','public.offset_broiler_cycles_1000(boolean)','EXECUTE');
  assert offset_broiler_cycles_1000(true)->>'alreadyApplied'='true';
  assert (select cycle_no from doc_farm_cycles where id=2)=2001;
  assert (select count(*) from broiler_cycle_offset_audit)=1;
end $$;
select 'Broiler cycle offset assertions passed' as result;
