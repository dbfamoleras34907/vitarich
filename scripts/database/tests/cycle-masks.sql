\set ON_ERROR_STOP on
-- Disposable local database only. Never run these fixtures on Supabase.
do $$ begin
  if current_database() <> 'vitarich_cycle_mask_test' then
    raise exception 'Requires disposable vitarich_cycle_mask_test database';
  end if;
end $$;
create role anon;
create role authenticated;
create table public.farms(id bigint primary key);
create table public.doc_farm_cycles(id bigint primary key, farm_id bigint references public.farms,
  cycle_no bigint, unique(farm_id, cycle_no));
create table public.flock_card(id bigint primary key, farm_id bigint references public.farms,
  farm_cycle_id bigint references public.doc_farm_cycles, cycle_no text, start_date date, void text default '1');
insert into public.farms values (1);
insert into public.doc_farm_cycles values (1,1,1003),(2,1,1004);
insert into public.flock_card values (1,1,1,'1003','2026-09-15','1');
\ir ../broiler-cycle-masks.sql
do $$ begin
  assert (select cycle_mask = '09261003' from public.flock_card where id=1), 'historical building mask';
  assert (select result = 'pending' from public.backfill_broiler_cycle_masks() where cycle_id=1), 'preview';
  assert (select cycle_mask is null from public.doc_farm_cycles where id=1), 'preview does not write';
  assert (select result = 'missing_start_date' from public.backfill_broiler_cycle_masks() where cycle_id=2), 'missing date';
  perform public.backfill_broiler_cycle_masks(true);
  assert (select cycle_mask = '09261003' from public.doc_farm_cycles where id=1), 'backfill';
  assert (select result = 'unchanged' from public.backfill_broiler_cycle_masks(true) where cycle_id=1), 'idempotency';
  insert into public.flock_card values (2,1,1,'1003','2026-08-31','1');
  assert (select cycle_mask = '08261003' from public.doc_farm_cycles where id=1), 'earliest building';
  update public.flock_card set void='0' where id=2;
  assert (select cycle_mask = '09261003' from public.doc_farm_cycles where id=1), 'void earliest';
  update public.flock_card set start_date='2027-01-01' where id=1;
  assert (select cycle_mask = '01271003' from public.doc_farm_cycles where id=1), 'date edit';
  assert (select cycle_no = '1003' from public.flock_card where id=1), 'internal identity preserved';
  begin
    update public.flock_card set start_date='2028-01-01' where id=1;
    raise exception 'test rollback';
  exception when raise_exception then null;
  end;
  assert (select cycle_mask = '01271003' from public.doc_farm_cycles where id=1), 'atomic rollback';
  delete from public.flock_card where id=1;
  assert (select cycle_mask is null from public.doc_farm_cycles where id=1), 'delete last usable date';
  assert not has_function_privilege('authenticated', 'public.backfill_broiler_cycle_masks(boolean)', 'execute'), 'owner only';
  assert public.format_broiler_cycle_mask('10000','2026-09-01') = '092610000', 'no truncation';
  assert public.format_broiler_cycle_mask('legacy','2026-09-01') is null, 'legacy nonnumeric';
  raise notice 'Cycle mask SQL assertions passed';
end $$;
