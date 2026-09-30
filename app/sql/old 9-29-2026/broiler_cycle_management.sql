-- Updated Cycle Master migration. Apply after doc_farm_cycles.sql.
-- Adds manual Cycle Master
-- close/reopen behavior while preserving Saved as the automatic current cycle.
-- Then deploy the current Broiler Growing, Harvest & Delivery, Clean Up save/
-- posting SQL files listed in docs/broiler-cycle-management.md.
begin;

alter table public.doc_farm_cycles
  add column if not exists closed_by uuid null references auth.users(id),
  add column if not exists reopened_by uuid null references auth.users(id),
  add column if not exists reopened_at timestamptz null;

alter table public.br_delivery
  add column if not exists farm_cycle_id bigint null references public.doc_farm_cycles(id);
alter table public.br_cleanup
  add column if not exists farm_cycle_id bigint null references public.doc_farm_cycles(id);
create index if not exists br_delivery_farm_cycle_id_idx on public.br_delivery(farm_cycle_id);
create index if not exists br_cleanup_farm_cycle_id_idx on public.br_cleanup(farm_cycle_id);

alter table public.doc_farm_cycles
  drop constraint if exists doc_farm_cycles_status_check;
alter table public.doc_farm_cycles
  add constraint doc_farm_cycles_status_check
  check (status in ('Saved', 'Past Open', 'Closed', 'Cancelled'));

create or replace function public.set_broiler_farm_cycle_state(
  p_farm_cycle_id bigint,
  p_action text
) returns public.doc_farm_cycles
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_user public.users%rowtype;
  v_cycle public.doc_farm_cycles%rowtype;
  v_action text := lower(btrim(coalesce(p_action, '')));
begin
  if v_actor is null then
    raise exception 'An authenticated user is required to manage Broiler cycles.' using errcode = '42501';
  end if;

  select * into v_user
  from public.users app_user
  where app_user.auth_id = v_actor
    and coalesce(btrim(app_user.isactive::text), '1') = '1';

  if not found or (
    coalesce(v_user.user_type, 3) <> 1
    and not exists (
      select 1 from public.user_permissions permission
      where permission.user_id = v_actor
        and permission.ilink = '/brd/cycle-master/edit'
        and permission.is_visible
    )
  ) then
    raise exception 'You do not have permission to manage Cycle Master.' using errcode = '42501';
  end if;

  select * into v_cycle
  from public.doc_farm_cycles cycle
  where cycle.id = p_farm_cycle_id
  for update;
  if not found then raise exception 'The Broiler cycle was not found.'; end if;

  if coalesce(v_user.user_type, 3) <> 1 and not exists (
    select 1 from public.users_farms assignment
    where assignment.users_id = v_user.id
      and assignment.farm_id = v_cycle.farm_id
      and coalesce(btrim(assignment.void::text), '1') = '1'
  ) then
    raise exception 'You do not have access to this cycle farm.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(73191, v_cycle.farm_id::integer);

  if v_action = 'close' then
    if v_cycle.status not in ('Saved', 'Past Open') then
      raise exception 'Only a Current Cycle or Past Open Cycle can be closed.';
    end if;
    if v_cycle.status = 'Saved' and exists (
      select 1
      from public.flock_card card
      where card.farm_cycle_id = v_cycle.id
        and card.void = '1'
        and card.status = 'Saved'
    ) then
      raise exception 'Current Cycle cannot be closed while it is still current for a building.';
    end if;
    update public.flock_card
    set status = 'Closed', updated_at = now(), updated_by = v_actor
    where farm_cycle_id = v_cycle.id and void = '1' and status = 'Saved';
    update public.doc_farm_cycles
    set status = 'Closed', closed_at = now(), closed_by = v_actor,
        updated_at = now(), updated_by = v_actor
    where id = v_cycle.id returning * into v_cycle;
  elsif v_action = 'reopen' then
    if v_cycle.status <> 'Closed' then raise exception 'Only a Closed Cycle can be reopened.'; end if;
    update public.doc_farm_cycles
    set status = 'Past Open', reopened_at = now(), reopened_by = v_actor,
        updated_at = now(), updated_by = v_actor
    where id = v_cycle.id returning * into v_cycle;
    update public.flock_card
    set status = 'Saved', updated_at = now(), updated_by = v_actor
    where farm_cycle_id = v_cycle.id and void = '1' and status = 'Closed';
  else
    raise exception 'Cycle action must be close or reopen.';
  end if;
  return v_cycle;
end;
$$;

revoke all on function public.set_broiler_farm_cycle_state(bigint, text) from public, anon;
grant execute on function public.set_broiler_farm_cycle_state(bigint, text) to authenticated;

drop trigger if exists close_doc_farm_cycle_after_flock_close_trigger on public.flock_card;

create or replace function public.ensure_active_doc_farm_cycle(p_farm_id bigint)
returns table(id bigint, cycle_no bigint, status text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cycle public.doc_farm_cycles%rowtype;
  v_next_cycle bigint;
begin
  perform pg_advisory_xact_lock(73191, p_farm_id::integer);
  select * into v_cycle from public.doc_farm_cycles cycle
  where cycle.farm_id = p_farm_id and cycle.status = 'Saved' limit 1;
  if v_cycle.id is null then
    if exists (
      select 1 from public.flock_card card
      where card.farm_id = p_farm_id and card.void = '1' and card.status = 'Saved'
        and (card.farm_cycle_id is null or exists (
          select 1 from public.doc_farm_cycles linked_cycle
          where linked_cycle.id = card.farm_cycle_id and linked_cycle.status = 'Saved'
        ))
        and card.building_whse_id not in (
          select excluded.building_whse_id from public.doc_cycle_excluded_buildings excluded
          where excluded.farm_id = p_farm_id
        )
    ) then
      raise exception 'A non-excluded building already has an active current cycle. Finish Clean up or close it in Cycle Master before creating the next cycle.';
    end if;
    select greatest(
      coalesce((select max(cycle.cycle_no) from public.doc_farm_cycles cycle where cycle.farm_id = p_farm_id), 0),
      coalesce((select max(card.cycle_no::bigint) from public.flock_card card
        where card.farm_id = p_farm_id and trim(coalesce(card.cycle_no, '')) ~ '^[0-9]+$'), 0)
    ) + 1 into v_next_cycle;
    insert into public.doc_farm_cycles(farm_id, cycle_no, created_by)
    values (p_farm_id, v_next_cycle, auth.uid()) returning * into v_cycle;
  end if;
  return query select v_cycle.id, v_cycle.cycle_no, v_cycle.status;
end;
$$;

create or replace function public.validate_doc_flock_cycle_assignment()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_excluded boolean;
  v_farm_cycle_no bigint;
begin
  if coalesce(new.extra->>'createdFrom', '') <> 'DOC_RECEIVING' then return new; end if;
  if new.building_whse_id is null then raise exception 'DOC Placement cycle requires a building.'; end if;
  select exists (select 1 from public.doc_cycle_excluded_buildings excluded
    where excluded.farm_id = new.farm_id and excluded.building_whse_id = new.building_whse_id) into v_excluded;
  if v_excluded then
    if new.farm_cycle_id is not null then raise exception 'Excluded Cycle Buildings cannot be assigned to the farm cycle.'; end if;
    if trim(coalesce(new.cycle_no, '')) = '' then raise exception 'Enter the Cycle Count for the exempted building.'; end if;
    if exists (select 1 from public.flock_card card where card.farm_id = new.farm_id
      and card.building_whse_id = new.building_whse_id and card.cycle_no = new.cycle_no
      and card.void = '1' and card.id is distinct from new.id) then
      raise exception 'Cycle Count already exists for this building.';
    end if;
  else
    if new.farm_cycle_id is null then raise exception 'This building must copy the selected farm Cycle Count.'; end if;
    select cycle.cycle_no into v_farm_cycle_no from public.doc_farm_cycles cycle
    where cycle.id = new.farm_cycle_id and cycle.farm_id = new.farm_id
      and cycle.status in ('Saved', 'Past Open');
    if v_farm_cycle_no is null or new.cycle_no <> v_farm_cycle_no::text then
      raise exception 'The building Cycle Count must match the selected farm cycle.';
    end if;
    if exists (select 1 from public.flock_card card where card.farm_cycle_id = new.farm_cycle_id
      and card.building_whse_id = new.building_whse_id and card.void = '1'
      and card.id is distinct from new.id) then
      raise exception 'This building already participated in the selected Farm Cycle and cannot receive another DOC placement.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_doc_flock_cycle_assignment_trigger on public.flock_card;
create trigger validate_doc_flock_cycle_assignment_trigger
before insert or update of farm_id, building_whse_id, cycle_no, farm_cycle_id, status, extra, void
on public.flock_card
for each row execute function public.validate_doc_flock_cycle_assignment();

-- A building may have more than one open cycle. Drop the superseded index so
-- reapplying this file also repairs databases where the earlier rule was installed.
drop index if exists public.flock_card_one_open_cycle_per_building_uidx;

notify pgrst, 'reload schema';
commit;
