\set ON_ERROR_STOP on
-- Run only in an empty disposable database: psql -f ownership.sql
\ir fixture.sql
\ir '../../../../app/sql/old 9/broiler_cycle_management.sql'
\ir '../../../../app/sql/old 9/open_broiler_past_cycle.sql'
\ir '../../broiler-cycle-masks.sql'
alter table public.flock_card add column created_at timestamptz default now();
create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger set_flock_card_updated_at before update on public.flock_card
for each row execute function public.set_updated_at();
set test.auth_uid = '11111111-1111-1111-1111-111111111111';
insert into auth.users values ('11111111-1111-1111-1111-111111111111');
insert into public.users values (1, auth.uid(), '1', 1);
insert into public.farms(id, code, name) values (152, 'RLK', 'RLK'), (153, 'OTHER', 'Other'), (154, 'AMBIG', 'Ambiguous');
insert into public.i_warehouse(id, whse_code, whse_name, warehouse_type, is_active, farm_id, farm_code)
values (2001, 'BD-0000182', 'Building 1', 'Building', true, 152, 'RLK'),
       (2002, 'BD-0000183', 'Building 2', 'Building', true, 152, 'RLK'),
       (2003, 'EXCLUDED', 'Excluded', 'Building', true, 152, 'RLK');
insert into public.doc_cycle_excluded_buildings values (152, 2003);
-- Seed legacy rows before installing the new guard.
insert into public.flock_card(farm_id, building_whse_id, cycle_no, start_date, age, status, void)
values (152, 2001, '150-01', '2026-10-01', 4, 'Saved', '1'),
       (152, 2002, '150-01', '2026-09-29', 6, 'Saved', '1');
create temp table original_cards as select id, to_jsonb(c) - 'farm_cycle_id' - 'updated_at' as payload from public.flock_card c;
insert into public.flock_card(farm_id, building_whse_id, cycle_no, status, void)
values (153, 2010, null, 'Saved', '1'),
       (154, 2011, '1001', 'Saved', '1'), (154, 2012, '1002', 'Saved', '1');
\ir '../../../../app/sql/new/20261005090927_broiler_cycle_master_ownership.sql'
\ir '../../../../app/sql/new/20261008110000_force_close_broiler_cycle.sql'
select * from public.repair_broiler_cycle_master_links(152, array[1,2]::bigint[]);
do $$ begin
  if exists(select 1 from public.doc_farm_cycles) then raise exception 'Preview mutated master'; end if;
  if exists(select 1 from public.flock_card where farm_cycle_id is not null) then raise exception 'Preview mutated cards'; end if;
end $$;
select * from public.repair_broiler_cycle_master_links(152, array[1,2]::bigint[], true);
create temp table repaired_cards as select id, to_jsonb(c) as payload from public.flock_card c where farm_id=152;
select * from public.repair_broiler_cycle_master_links(152, array[1,2]::bigint[], true);
do $$ begin
  if (select count(*) from public.doc_farm_cycles) <> 1 then raise exception 'Repair created duplicate masters'; end if;
  if (select count(*) from public.flock_card where farm_id=152) <> 2 then raise exception 'Repair created flock cards'; end if;
  if exists(select 1 from public.flock_card c join original_cards o using(id)
    where to_jsonb(c) - 'farm_cycle_id' - 'updated_at' <> o.payload) then raise exception 'Repair changed placement history'; end if;
  if exists(select 1 from public.flock_card c join repaired_cards o using(id)
    where to_jsonb(c) <> o.payload) then raise exception 'Repair retry changed cards or audit timestamp'; end if;
  if (select count(*) from public.flock_card c join public.doc_farm_cycles m on m.id=c.farm_cycle_id
    where m.farm_id=152 and m.cycle_key='150-01' and m.cycle_mask='150-01') <> 2 then raise exception 'Growing membership or legacy mask incorrect'; end if;
end $$;
do $$ begin
  begin
    perform public.repair_broiler_cycle_master_links(153,array[3]::bigint[],true);
    raise exception 'TEST: guessed missing count';
  exception when raise_exception then
    if sqlerrm not like 'A selected regular building has a missing or invalid count%' then raise; end if;
  end;
  begin
    perform public.repair_broiler_cycle_master_links(154,array[4,5]::bigint[],true);
    raise exception 'TEST: merged different counts';
  exception when raise_exception then
    if sqlerrm not like 'Selected regular buildings do not share one Cycle Count%' then raise; end if;
  end;
  if exists(select 1 from public.doc_farm_cycles where farm_id in(153,154)) then raise exception 'Failed repair changed masters'; end if;
end $$;
-- Excluded text count remains intact but master ownership is required.
insert into public.flock_card(farm_id, building_whse_id, cycle_no, farm_cycle_id, status, void)
select 152, 2003, 'Backlog Cycle 7', id, 'Saved', '1' from public.doc_farm_cycles where farm_id=152;
do $$ declare v_master bigint; begin
  select id into v_master from public.doc_farm_cycles where farm_id=152;
  begin
    insert into public.flock_card(farm_id, building_whse_id, cycle_no, status, void)
      values (152,2003,'Backlog Cycle 8','Saved','1');
    raise exception 'TEST: accepted unlinked excluded card';
  exception when raise_exception then
    if sqlerrm not like 'Every building requires%' then raise; end if;
  end;
  begin
    insert into public.flock_card(farm_id, building_whse_id, cycle_no, farm_cycle_id, status, void)
      values (152,2001,'1007',v_master,'Saved','1');
    raise exception 'TEST: accepted duplicate active card';
  exception when raise_exception then
    if sqlerrm not like 'This building already has an active cycle%' then raise; end if;
  end;
  begin
    update public.flock_card set farm_cycle_id=null where id=1;
    raise exception 'TEST: accepted clearing master';
  exception when raise_exception then
    if sqlerrm not like 'Every building requires%' then raise; end if;
  end;
  begin
    update public.flock_card set farm_id=153 where id=1;
    raise exception 'TEST: accepted cross-farm master';
  exception when raise_exception then
    if sqlerrm not like 'The Cycle Master does not belong%' then raise; end if;
  end;
  begin
    update public.flock_card set cycle_no='999' where id=1;
    raise exception 'TEST: accepted mismatched count';
  exception when raise_exception then
    if sqlerrm not like 'The building Cycle Count must match%' then raise; end if;
  end;
  begin
    perform public.open_broiler_past_cycle(152,2001,(date_trunc('month',current_date)-interval '4 months')::date);
    raise exception 'TEST: opened second active building cycle';
  exception when raise_exception then
    if sqlerrm not like 'This building already has an active cycle%' then raise; end if;
  end;
  if (select count(*) from public.doc_farm_cycles) <> 1 then raise exception 'Failed creation left a master behind'; end if;
  begin
    perform public.set_broiler_farm_cycle_state(v_master,'close',current_date,null);
    raise exception 'TEST: force close accepted missing reason';
  exception when raise_exception then
    if sqlerrm not like 'Enter a reason%' then raise; end if;
  end;
  if exists(select 1 from public.notification_outbox) then raise exception 'Failed force close emitted an event'; end if;
  update public.flock_card set status='Closed' where id=2;
  perform public.set_broiler_farm_cycle_state(v_master,'close',current_date,'Management-approved manual close');
  if (select status from public.doc_farm_cycles where id=v_master) <> 'Force Closed' then raise exception 'Current cycle was not force closed'; end if;
  if exists(select 1 from public.flock_card where farm_cycle_id=v_master and status<>'Closed') then raise exception 'Linked open buildings were not closed'; end if;
  if (select force_close_reason from public.doc_farm_cycles where id=v_master) <> 'Management-approved manual close' then raise exception 'Force-close reason was not persisted'; end if;
end $$;
-- Force closing and reopening preserves membership; reopening over another active
-- card is rejected and the entire state mutation rolls back.
select public.set_broiler_farm_cycle_state(id,'reopen') from public.doc_farm_cycles where farm_id=152;
do $$ begin
  if (select status from public.flock_card where id=1) <> 'Saved' then raise exception 'Force-closed building was not reopened'; end if;
  if (select status from public.flock_card where id=2) <> 'Closed' then raise exception 'Previously completed building was incorrectly reopened'; end if;
end $$;
select public.set_broiler_farm_cycle_state(id,'close',current_date,'Close again after reopen') from public.doc_farm_cycles where farm_id=152;
select * from public.ensure_active_doc_farm_cycle(152);
insert into public.flock_card(farm_id,building_whse_id,cycle_no,farm_cycle_id,status,void)
select 152,2001,cycle_no::text,id,'Saved','1' from public.doc_farm_cycles where farm_id=152 and status='Saved';
do $$ begin
  begin
    perform public.set_broiler_farm_cycle_state((select id from public.doc_farm_cycles where cycle_key='150-01'),'reopen');
    raise exception 'TEST: reopened over active card';
  exception when raise_exception then
    if sqlerrm not like 'This building already has an active cycle%' then raise; end if;
  end;
  if (select status from public.doc_farm_cycles where cycle_key='150-01') <> 'Force Closed' then raise exception 'Failed reopen changed state'; end if;
  if (select count(*) from public.notification_outbox where event_key='CYCLE_MASTER_EDITED') <> 3 then raise exception 'Cycle actions did not emit exactly one event each'; end if;
  if exists(select 1 from public.notification_outbox where farm_id<>152 or recipient_farm_id<>152) then raise exception 'Cycle notification farm routing is invalid'; end if;
  if has_function_privilege('authenticated','public.repair_broiler_cycle_master_links(bigint,bigint[],boolean)','execute') then
    raise exception 'Authenticated role can run owner-only maintenance';
  end if;
end $$;
select public.process_notification_outbox(50);
do $$ begin
  if exists(select 1 from public.notification_outbox where status<>'processed') then raise exception 'No-rule dispatch did not complete safely'; end if;
  if (select count(distinct dedupe_key) from public.notification_outbox) <> 3 then raise exception 'Cycle event dedupe identities are not unique'; end if;
end $$;
-- Idempotent deployment.
\ir '../../../../app/sql/new/20261005090927_broiler_cycle_master_ownership.sql'
\ir '../../../../app/sql/new/20261008110000_force_close_broiler_cycle.sql'
select 'Cycle ownership SQL checks passed' as result;
