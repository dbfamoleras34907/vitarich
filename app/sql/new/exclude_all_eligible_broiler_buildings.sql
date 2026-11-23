-- One-time, idempotent data query for DOC Placement settings.
--
-- Adds every active Building belonging to an active, approved Broiler farm to
-- public.doc_cycle_excluded_buildings. A farm may have an active Cycle Master.
-- Buildings with an active saved flock are intentionally skipped because their
-- cycle-assignment rule must not change until posted Clean Up is complete.

begin;

set local statement_timeout = '30s';

with broiler_farms as (
  select
    farm.id,
    farm.code,
    farm.associated_warehouses
  from public.farms farm
  where coalesce(btrim(farm.void::text), '0') = '1'
    and lower(btrim(coalesce(farm.approval_status, ''))) = 'approved'
    and upper(btrim(coalesce(farm.farm_type, ''))) in ('BR', 'BROILER')
),
associated_warehouse_links as (
  select
    farm.id as farm_id,
    link.value as warehouse_link
  from broiler_farms farm
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(to_jsonb(farm.associated_warehouses)) = 'array'
        then to_jsonb(farm.associated_warehouses)
      else '[]'::jsonb
    end
  ) link(value)
),
candidate_buildings as (
  select farm.id as farm_id, building.id as building_whse_id
  from broiler_farms farm
  join public.i_warehouse building on building.farm_id = farm.id
  where building.warehouse_type = 'Building'
    and building.is_active is true

  union

  select farm.id as farm_id, building.id as building_whse_id
  from broiler_farms farm
  join public.i_warehouse building
    on upper(btrim(coalesce(building.farm_code, ''))) = upper(btrim(farm.code))
  where building.warehouse_type = 'Building'
    and building.is_active is true
    and nullif(btrim(coalesce(farm.code, '')), '') is not null

  union

  select link.farm_id, building.id as building_whse_id
  from associated_warehouse_links link
  join public.i_warehouse building on (
    (
      jsonb_typeof(link.warehouse_link) = 'object'
      and link.warehouse_link->>'id' ~ '^[0-9]+$'
      and building.id = (link.warehouse_link->>'id')::bigint
    )
    or (
      jsonb_typeof(link.warehouse_link) = 'object'
      and upper(btrim(building.whse_code)) = upper(btrim(coalesce(
        link.warehouse_link->>'whse_code',
        link.warehouse_link->>'code',
        ''
      )))
    )
    or (
      jsonb_typeof(link.warehouse_link) = 'string'
      and upper(btrim(building.whse_code)) = upper(btrim(link.warehouse_link #>> '{}'))
    )
  )
  where building.warehouse_type = 'Building'
    and building.is_active is true
),
eligible_buildings as (
  select candidate.farm_id, candidate.building_whse_id
  from candidate_buildings candidate
  where not exists (
    select 1
    from public.flock_card card
    where card.farm_id = candidate.farm_id
      and card.building_whse_id = candidate.building_whse_id
      and card.void = '1'
      and card.status = 'Saved'
  )
),
inserted_buildings as (
  insert into public.doc_cycle_excluded_buildings (
    farm_id,
    building_whse_id,
    created_by
  )
  select
    eligible.farm_id,
    eligible.building_whse_id,
    auth.uid()
  from eligible_buildings eligible
  on conflict (farm_id, building_whse_id) do nothing
  returning farm_id, building_whse_id
)
select
  (select count(*) from candidate_buildings) as candidate_buildings,
  (
    select count(*)
    from candidate_buildings candidate
    where exists (
      select 1
      from public.flock_card card
      where card.farm_id = candidate.farm_id
        and card.building_whse_id = candidate.building_whse_id
        and card.void = '1'
        and card.status = 'Saved'
    )
  ) as skipped_active_flock_buildings,
  (select count(*) from eligible_buildings) as eligible_buildings,
  (select count(*) from inserted_buildings) as inserted_exclusions,
  (
    (select count(*) from eligible_buildings)
    - (select count(*) from inserted_buildings)
  ) as already_excluded_buildings;

commit;
