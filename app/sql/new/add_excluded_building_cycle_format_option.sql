-- Adds a per-excluded-building Cycle # formatting choice for DOC Placement.
-- Unchecked/default: MMYY#### using the Cycle Start selected by the user.
-- Checked: preserve the manually entered Cycle Count as the Cycle #.
begin;

alter table public.doc_cycle_excluded_buildings
  add column if not exists do_not_format_cycle_number boolean not null default false;

comment on column public.doc_cycle_excluded_buildings.do_not_format_cycle_number is
  'When true, new DOC Placement flock cards snapshot their manual Cycle Count as Cycle # without MMYY formatting.';

create or replace function public.save_doc_cycle_excluded_building_settings(
  p_farm_id bigint,
  p_buildings jsonb
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
  if p_buildings is null or jsonb_typeof(p_buildings) <> 'array' then
    raise exception 'Excluded Cycle Building settings must be an array.';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_buildings) as requested(
      building_whse_id bigint,
      do_not_format_cycle_number boolean
    )
    where requested.building_whse_id is null or requested.building_whse_id <= 0
  ) then
    raise exception 'Each excluded Cycle Building requires a valid Building warehouse.';
  end if;
  if (
    select count(*)
    from jsonb_to_recordset(p_buildings) as requested(
      building_whse_id bigint,
      do_not_format_cycle_number boolean
    )
  ) <> (
    select count(distinct requested.building_whse_id)
    from jsonb_to_recordset(p_buildings) as requested(
      building_whse_id bigint,
      do_not_format_cycle_number boolean
    )
  ) then
    raise exception 'An excluded Cycle Building was provided more than once.';
  end if;

  -- Serialize with DOC cycle creation/validation so an exclusion membership
  -- cannot change between its active-flock check and the saved setting rows.
  perform pg_advisory_xact_lock(73191, p_farm_id::integer);

  select coalesce(existing.building_whse_id, requested.building_whse_id)
    into v_changed_building
  from (
    select building_whse_id
    from public.doc_cycle_excluded_buildings
    where farm_id = p_farm_id
  ) existing
  full join (
    select setting.building_whse_id
    from jsonb_to_recordset(p_buildings) as setting(
      building_whse_id bigint,
      do_not_format_cycle_number boolean
    )
  ) requested using (building_whse_id)
  where (existing.building_whse_id is null or requested.building_whse_id is null)
    and exists (
      select 1
      from public.flock_card card
      where card.farm_id = p_farm_id
        and card.building_whse_id = coalesce(existing.building_whse_id, requested.building_whse_id)
        and card.void = '1'
        and card.status = 'Saved'
    )
  limit 1;

  if v_changed_building is not null then
    raise exception 'Building % still has an active flock. Complete Clean up before changing its cycle exclusion.', v_changed_building;
  end if;

  delete from public.doc_cycle_excluded_buildings excluded
  where excluded.farm_id = p_farm_id
    and not exists (
      select 1
      from jsonb_to_recordset(p_buildings) as requested(
        building_whse_id bigint,
        do_not_format_cycle_number boolean
      )
      where requested.building_whse_id = excluded.building_whse_id
    );

  insert into public.doc_cycle_excluded_buildings (
    farm_id,
    building_whse_id,
    do_not_format_cycle_number,
    created_by
  )
  select
    p_farm_id,
    requested.building_whse_id,
    coalesce(requested.do_not_format_cycle_number, false),
    auth.uid()
  from jsonb_to_recordset(p_buildings) as requested(
    building_whse_id bigint,
    do_not_format_cycle_number boolean
  )
  on conflict (farm_id, building_whse_id) do update
    set do_not_format_cycle_number = excluded.do_not_format_cycle_number;
end;
$$;

revoke all on function public.save_doc_cycle_excluded_building_settings(bigint, jsonb) from public, anon;
grant execute on function public.save_doc_cycle_excluded_building_settings(bigint, jsonb) to authenticated;
grant update (do_not_format_cycle_number) on public.doc_cycle_excluded_buildings to authenticated;

notify pgrst, 'reload schema';
commit;
