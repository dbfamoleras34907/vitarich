-- Farm-level DOC cycles with building-level flock cards.
create table if not exists public.doc_farm_cycles (
  id bigint generated always as identity primary key,
  farm_id bigint not null references public.farms(id),
  cycle_no bigint not null check (cycle_no > 0),
  status text not null default 'Saved' check (status in ('Saved', 'Past Open', 'Closed', 'Cancelled')),
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  updated_at timestamptz null,
  closed_at timestamptz null,
  constraint doc_farm_cycles_farm_cycle_key unique (farm_id, cycle_no)
);

alter table public.doc_farm_cycles
  add column if not exists closed_by uuid null references auth.users(id),
  add column if not exists reopened_by uuid null references auth.users(id),
  add column if not exists reopened_at timestamptz null;

alter table public.doc_farm_cycles
  drop constraint if exists doc_farm_cycles_status_check;
alter table public.doc_farm_cycles
  add constraint doc_farm_cycles_status_check
  check (status in ('Saved', 'Past Open', 'Closed', 'Cancelled'));

create unique index if not exists doc_farm_cycles_one_saved_per_farm_idx
  on public.doc_farm_cycles (farm_id) where status = 'Saved';

create table if not exists public.doc_cycle_excluded_buildings (
  id bigint generated always as identity primary key,
  farm_id bigint not null references public.farms(id),
  building_whse_id bigint not null references public.i_warehouse(id),
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint doc_cycle_excluded_buildings_key unique (farm_id, building_whse_id)
);

alter table public.flock_card
  add column if not exists farm_cycle_id bigint null references public.doc_farm_cycles(id);

create index if not exists flock_card_farm_cycle_id_idx on public.flock_card(farm_cycle_id);
create index if not exists doc_cycle_excluded_buildings_farm_idx
  on public.doc_cycle_excluded_buildings(farm_id);

create or replace function public.save_doc_cycle_excluded_buildings(
  p_farm_id bigint,
  p_building_whse_ids bigint[]
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_changed_building bigint;
begin
  if p_farm_id is null then
    raise exception 'Please select a farm.';
  end if;

  select coalesce(existing.building_whse_id, requested.building_whse_id) into v_changed_building
  from (
    select building_whse_id from public.doc_cycle_excluded_buildings where farm_id = p_farm_id
  ) existing
  full join (
    select distinct unnest(coalesce(p_building_whse_ids, '{}'::bigint[])) as building_whse_id
  ) requested using (building_whse_id)
  where (existing.building_whse_id is null or requested.building_whse_id is null)
  and exists (
    select 1 from public.flock_card card
    where card.farm_id = p_farm_id
      and card.building_whse_id = coalesce(existing.building_whse_id, requested.building_whse_id)
      and card.void = '1'
      and card.status = 'Saved'
  )
  limit 1;

  if v_changed_building is not null then
    raise exception 'Building % still has an active flock. Complete Clean up before changing its cycle exclusion.', v_changed_building;
  end if;

  delete from public.doc_cycle_excluded_buildings
  where farm_id = p_farm_id
    and not (building_whse_id = any(coalesce(p_building_whse_ids, '{}'::bigint[])));

  if exists (
    select 1 from public.doc_cycle_excluded_buildings
    where farm_id = p_farm_id
      and not (building_whse_id = any(coalesce(p_building_whse_ids, '{}'::bigint[])))
  ) then
    raise exception 'Unable to remove cycle exclusions. Check the DELETE policy for doc_cycle_excluded_buildings.';
  end if;
  insert into public.doc_cycle_excluded_buildings(farm_id, building_whse_id, created_by)
  select p_farm_id, building_id, auth.uid()
  from unnest(coalesce(p_building_whse_ids, '{}'::bigint[])) building_id
  on conflict (farm_id, building_whse_id) do nothing;
end;
$$;

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

  select * into v_cycle
  from public.doc_farm_cycles cycle
  where cycle.farm_id = p_farm_id and cycle.status = 'Saved'
  limit 1;

  if v_cycle.id is null then
    if exists (
      select 1
      from public.flock_card card
      where card.farm_id = p_farm_id
        and card.void = '1'
        and card.status = 'Saved'
        and (
          card.farm_cycle_id is null
          or exists (
            select 1 from public.doc_farm_cycles linked_cycle
            where linked_cycle.id = card.farm_cycle_id and linked_cycle.status = 'Saved'
          )
        )
        and card.building_whse_id not in (
          select excluded.building_whse_id
          from public.doc_cycle_excluded_buildings excluded
          where excluded.farm_id = p_farm_id
        )
    ) then
      raise exception 'A non-excluded building already has an active cycle. Finish Clean up before creating the farm cycle.';
    end if;

    select greatest(
      coalesce((select max(cycle.cycle_no) from public.doc_farm_cycles cycle where cycle.farm_id = p_farm_id), 0),
      coalesce((select max(card.cycle_no::bigint) from public.flock_card card
                where card.farm_id = p_farm_id and trim(coalesce(card.cycle_no, '')) ~ '^[0-9]+$'), 0)
    ) + 1 into v_next_cycle;

    insert into public.doc_farm_cycles(farm_id, cycle_no, created_by)
    values (p_farm_id, v_next_cycle, auth.uid())
    returning * into v_cycle;
  end if;

  return query select v_cycle.id, v_cycle.cycle_no, v_cycle.status;
end;
$$;

create or replace function public.preview_doc_farm_cycle(p_farm_id bigint)
returns table(id bigint, cycle_no bigint, status text)
language sql
security invoker
set search_path = public
as $$
  with active_cycle as (
    select cycle.id, cycle.cycle_no, cycle.status
    from public.doc_farm_cycles cycle
    where cycle.farm_id = p_farm_id and cycle.status = 'Saved'
    limit 1
  ), next_cycle as (
    select null::bigint as id,
      greatest(
        coalesce((select max(cycle.cycle_no) from public.doc_farm_cycles cycle where cycle.farm_id = p_farm_id), 0),
        coalesce((select max(card.cycle_no::bigint) from public.flock_card card
                  where card.farm_id = p_farm_id and trim(coalesce(card.cycle_no, '')) ~ '^[0-9]+$'), 0)
      ) + 1 as cycle_no,
      'Saved'::text as status
  )
  select * from active_cycle
  union all
  select * from next_cycle where not exists (select 1 from active_cycle)
  limit 1;
$$;

create or replace function public.close_completed_doc_farm_cycle(p_farm_cycle_id bigint)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_farm_cycle_id is null then return; end if;

  update public.doc_farm_cycles cycle
  set status = 'Closed', updated_by = auth.uid(), updated_at = now(), closed_at = now()
  where cycle.id = p_farm_cycle_id
    and cycle.status = 'Saved'
    and not exists (
      select 1 from public.flock_card card
      where card.farm_cycle_id = cycle.id and card.void = '1' and card.status = 'Saved'
    );
end;
$$;

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
      select 1
      from public.user_permissions permission
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

  if not found then
    raise exception 'The Broiler cycle was not found.';
  end if;

  if coalesce(v_user.user_type, 3) <> 1 and not exists (
    select 1
    from public.users_farms assignment
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
    where farm_cycle_id = v_cycle.id
      and void = '1'
      and status = 'Saved';

    update public.doc_farm_cycles
    set status = 'Closed', closed_at = now(), closed_by = v_actor,
        updated_at = now(), updated_by = v_actor
    where id = v_cycle.id
    returning * into v_cycle;
  elsif v_action = 'reopen' then
    if v_cycle.status <> 'Closed' then
      raise exception 'Only a Closed Cycle can be reopened.';
    end if;

    update public.doc_farm_cycles
    set status = 'Past Open', reopened_at = now(), reopened_by = v_actor,
        updated_at = now(), updated_by = v_actor
    where id = v_cycle.id
    returning * into v_cycle;

    update public.flock_card
    set status = 'Saved', updated_at = now(), updated_by = v_actor
    where farm_cycle_id = v_cycle.id
      and void = '1'
      and status = 'Closed';
  else
    raise exception 'Cycle action must be close or reopen.';
  end if;

  return v_cycle;
end;
$$;

revoke all on function public.set_broiler_farm_cycle_state(bigint, text) from public, anon;
grant execute on function public.set_broiler_farm_cycle_state(bigint, text) to authenticated;

create or replace function public.close_doc_farm_cycle_after_flock_close()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.farm_cycle_id is not null and new.status = 'Closed' and old.status is distinct from 'Closed' then
    perform public.close_completed_doc_farm_cycle(new.farm_cycle_id);
  end if;
  return new;
end;
$$;

-- Cycle Master owns the farm-cycle close action. Clean Up may close a building,
-- but it no longer closes the farm cycle automatically.
drop trigger if exists close_doc_farm_cycle_after_flock_close_trigger on public.flock_card;

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

  if new.building_whse_id is null then
    raise exception 'DOC Placement cycle requires a building.';
  end if;

  if exists (
    select 1 from public.flock_card card
    where card.farm_id = new.farm_id
      and card.building_whse_id = new.building_whse_id
      and card.void = '1' and card.status = 'Saved'
      and card.id is distinct from new.id
      and (new.farm_cycle_id is null or card.farm_cycle_id = new.farm_cycle_id)
  ) then
    raise exception 'This building already has an active cycle.';
  end if;

  select exists (
    select 1 from public.doc_cycle_excluded_buildings excluded
    where excluded.farm_id = new.farm_id and excluded.building_whse_id = new.building_whse_id
  ) into v_excluded;

  if v_excluded then
    if new.farm_cycle_id is not null then
      raise exception 'Excluded Cycle Buildings cannot be assigned to the farm cycle.';
    end if;
    if trim(coalesce(new.cycle_no, '')) = '' then
      raise exception 'Enter the Cycle Count for the exempted building.';
    end if;
    if exists (
      select 1 from public.flock_card card
      where card.farm_id = new.farm_id
        and card.building_whse_id = new.building_whse_id
        and card.cycle_no = new.cycle_no and card.void = '1'
        and card.id is distinct from new.id
    ) then
      raise exception 'Cycle Count already exists for this building.';
    end if;
  else
    if new.farm_cycle_id is null then
      raise exception 'This building must copy the active farm Cycle Count.';
    end if;
    select cycle.cycle_no into v_farm_cycle_no
    from public.doc_farm_cycles cycle
    where cycle.id = new.farm_cycle_id and cycle.farm_id = new.farm_id
      and cycle.status in ('Saved', 'Past Open');
    if v_farm_cycle_no is null or new.cycle_no <> v_farm_cycle_no::text then
      raise exception 'The building Cycle Count must match the active farm cycle.';
    end if;
    if exists (
      select 1 from public.flock_card card
      where card.farm_cycle_id = new.farm_cycle_id
        and card.building_whse_id = new.building_whse_id
        and card.void = '1'
        and card.id is distinct from new.id
    ) then
      raise exception 'This building already participated in the active Farm Cycle and cannot receive another DOC placement.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_doc_flock_cycle_assignment_trigger on public.flock_card;
create trigger validate_doc_flock_cycle_assignment_trigger
before insert or update of farm_id, building_whse_id, cycle_no, farm_cycle_id, status, extra on public.flock_card
for each row execute function public.validate_doc_flock_cycle_assignment();
