-- Farm-level DOC cycles with building-level flock cards.
create table if not exists public.doc_farm_cycles (
  id bigint generated always as identity primary key,
  farm_id bigint not null references public.farms(id),
  cycle_no bigint not null check (cycle_no > 0),
  status text not null default 'Saved' check (status in ('Saved', 'Closed', 'Cancelled')),
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  updated_at timestamptz null,
  closed_at timestamptz null,
  constraint doc_farm_cycles_farm_cycle_key unique (farm_id, cycle_no)
);

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

  delete from public.doc_cycle_excluded_buildings where farm_id = p_farm_id;
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

drop trigger if exists close_doc_farm_cycle_after_flock_close_trigger on public.flock_card;
create trigger close_doc_farm_cycle_after_flock_close_trigger
after update of status on public.flock_card
for each row execute function public.close_doc_farm_cycle_after_flock_close();

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
    where cycle.id = new.farm_cycle_id and cycle.farm_id = new.farm_id and cycle.status = 'Saved';
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
