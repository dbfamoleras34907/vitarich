-- Breeder age convention: the original age anchor is day one (0.1).
-- This aligns stored Egg Laying history with the Egg Laying Production grid
-- and preserves flock age when a placement was created by a transfer.
begin;

alter table public.tbl_placement
  add column if not exists age_anchor_date date;

update public.tbl_egglaying as egg
set age = greatest(0, egg.date_laying - coalesce(placement.age_anchor_date, placement.placement_date) + 1)
from public.tbl_placement as placement
where placement.id = egg.placement_id
  and egg.age is distinct from greatest(0, egg.date_laying - coalesce(placement.age_anchor_date, placement.placement_date) + 1);

create or replace function public.save_breeder_egg_layings(p_rows jsonb)
returns setof public.tbl_egglaying
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_input jsonb;
  v_id bigint;
  v_date date;
  v_placement_id bigint;
  v_farm record;
  v_placement record;
  v_existing public.tbl_egglaying%rowtype;
  v_saved public.tbl_egglaying%rowtype;
  v_tep numeric;
  v_hatching numeric;
  v_classb numeric;
  v_junior numeric;
  v_dirty numeric;
  v_misshapen numeric;
  v_off_size numeric;
  v_thin_shell numeric;
  v_jumbo numeric;
  v_crack numeric;
  v_condemn numeric;
  v_total numeric;
  v_action text;
begin
  if v_actor is null then raise exception 'An authenticated user is required.'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Add at least one Egg Laying row.';
  end if;

  for v_input in select value from jsonb_array_elements(p_rows)
  loop
    v_id := nullif(v_input->>'id', '')::bigint;
    v_date := nullif(v_input->>'date_laying', '')::date;
    v_placement_id := nullif(v_input->>'placement_id', '')::bigint;
    if v_date is null or v_date > current_date then raise exception 'Date Laying must not be blank or in the future.'; end if;
    if v_placement_id is null then raise exception 'Placement is required.'; end if;

    select placement.farm_id, placement.building_id, placement.building_no, placement.placement_date, placement.age_anchor_date
    into v_placement
    from public.tbl_placement placement
    where placement.id = v_placement_id;
    if not found or v_placement.farm_id is null then raise exception 'Egg Laying requires a placement with an assigned farm.'; end if;

    select farm.id, farm.code, farm.name, farm.farm_type
    into v_farm
    from public.farms farm
    where farm.id = v_placement.farm_id
      and upper(btrim(coalesce(farm.farm_type, ''))) in ('BE', 'BREEDER');
    if not found then raise exception 'Egg Laying requires an active Breeder farm.'; end if;

    v_action := case when v_id is null then 'insert' else 'edit' end;
    perform public.assert_breeder_egg_laying_access(v_action, v_farm.id);
    perform pg_advisory_xact_lock(hashtextextended(
      'EGG_LAYING:' || v_farm.id || ':' || coalesce(v_placement.building_id, 0) || ':' || v_date,
      0
    ));

    v_tep := coalesce((v_input->>'tep_collection')::numeric, 0);
    v_hatching := coalesce((v_input->>'hatching_egg')::numeric, 0);
    v_classb := coalesce((v_input->>'classb')::numeric, 0);
    v_junior := coalesce((v_input->>'junior')::numeric, 0);
    v_dirty := coalesce((v_input->>'table_egg_dirty')::numeric, 0);
    v_misshapen := coalesce((v_input->>'table_egg_misshapen')::numeric, 0);
    v_off_size := coalesce((v_input->>'table_egg_off_size')::numeric, 0);
    v_thin_shell := coalesce((v_input->>'table_egg_thin_shell')::numeric, 0);
    v_jumbo := coalesce((v_input->>'jumbo')::numeric, 0);
    v_crack := coalesce((v_input->>'crack')::numeric, 0);
    v_condemn := coalesce((v_input->>'condemn')::numeric, 0);
    if least(v_tep, v_hatching, v_classb, v_junior, v_dirty, v_misshapen, v_off_size, v_thin_shell, v_jumbo, v_crack, v_condemn) < 0
       or v_tep <> trunc(v_tep) or v_hatching <> trunc(v_hatching) or v_classb <> trunc(v_classb)
       or v_junior <> trunc(v_junior) or v_dirty <> trunc(v_dirty) or v_misshapen <> trunc(v_misshapen)
       or v_off_size <> trunc(v_off_size) or v_thin_shell <> trunc(v_thin_shell) or v_jumbo <> trunc(v_jumbo)
       or v_crack <> trunc(v_crack) or v_condemn <> trunc(v_condemn) then
      raise exception 'Egg Laying quantities must be non-negative whole numbers.';
    end if;
    v_total := v_hatching + v_classb + v_junior + v_dirty + v_misshapen + v_off_size + v_thin_shell + v_jumbo + v_crack + v_condemn;
    if v_tep <= 0 or v_tep <> v_total then raise exception 'TEP Collection must equal Total Egg Classification.'; end if;

    if exists (
      select 1 from public.tbl_egglaying duplicate_row
      where duplicate_row.is_active = true
        and duplicate_row.farm_id = v_farm.id
        and duplicate_row.building_id is not distinct from v_placement.building_id
        and duplicate_row.date_laying = v_date
        and duplicate_row.id is distinct from v_id
    ) then raise exception 'Date Laying already has a saved active record for this building.'; end if;

    if v_id is null then
      insert into public.tbl_egglaying (
        placement_id, date_laying, farm_id, farm_name, building_id, building, age,
        tep_collection, hatching_egg, classb, junior, table_egg_dirty, table_egg_misshapen,
        table_egg_off_size, table_egg_thin_shell, jumbo, crack, condemn, is_active, created_by,
        notification_revision, notification_event_key
      ) values (
        v_placement_id, v_date, v_farm.id, v_farm.name, v_placement.building_id, v_placement.building_no,
        greatest(0, v_date - coalesce(v_placement.age_anchor_date, v_placement.placement_date) + 1), v_tep, v_hatching, v_classb, v_junior,
        v_dirty, v_misshapen, v_off_size, v_thin_shell, v_jumbo, v_crack, v_condemn, true, v_actor,
        1, 'EGG_LAYING_POSTED'
      ) returning * into v_saved;
    else
      select * into v_existing from public.tbl_egglaying where id = v_id for update;
      if not found or not v_existing.is_active then raise exception 'Egg Laying record is not active.'; end if;
      if v_existing.farm_id is distinct from v_farm.id or v_existing.placement_id is distinct from v_placement_id then
        raise exception 'A saved Egg Laying record cannot be moved to another placement or farm.';
      end if;
      perform public.assert_egg_laying_dispatch_allocation(
        v_id, v_hatching, v_classb, v_junior, v_dirty + v_misshapen + v_off_size + v_thin_shell,
        v_jumbo, v_crack, v_condemn
      );
      update public.tbl_egglaying set
        date_laying = v_date, farm_name = v_farm.name, building_id = v_placement.building_id,
        building = v_placement.building_no,
        age = greatest(0, v_date - coalesce(v_placement.age_anchor_date, v_placement.placement_date) + 1),
        tep_collection = v_tep, hatching_egg = v_hatching, classb = v_classb, junior = v_junior,
        table_egg_dirty = v_dirty, table_egg_misshapen = v_misshapen, table_egg_off_size = v_off_size,
        table_egg_thin_shell = v_thin_shell, jumbo = v_jumbo, crack = v_crack, condemn = v_condemn,
        updated_at = now(), updated_by = v_actor, notification_revision = notification_revision + 1,
        notification_event_key = 'EGG_LAYING_EDITED'
      where id = v_id returning * into v_saved;
    end if;
    return next v_saved;
  end loop;
end;
$$;

commit;
