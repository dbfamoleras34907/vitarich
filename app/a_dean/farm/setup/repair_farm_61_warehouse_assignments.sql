begin;

do $$
declare
  expected_warehouse_ids constant bigint[] := array[4, 5, 6, 7, 8, 9]::bigint[];
  warehouse_reference_count integer;
  matched_warehouse_count integer;
  updated_warehouse_count integer;
begin
  if not exists (
    select 1
    from public.farms
    where id = 61
      and code = 'FRM000062'
  ) then
    raise exception 'Repair stopped: Farm 61 / FRM000062 was not found.';
  end if;

  if exists (
    select 1
    from public.farms farm
    cross join lateral jsonb_array_elements(
      coalesce(to_jsonb(farm.associated_warehouses), '[]'::jsonb)
    ) item
    where farm.id <> 61
      and item->>'id' ~ '^[0-9]+$'
      and (item->>'id')::bigint = any(expected_warehouse_ids)
  ) then
    raise exception 'Repair stopped: another farm references one of warehouse IDs 4 through 9.';
  end if;

  select count(*), count(distinct warehouse.id)
  into warehouse_reference_count, matched_warehouse_count
  from public.farms farm
  cross join lateral jsonb_array_elements(
    coalesce(to_jsonb(farm.associated_warehouses), '[]'::jsonb)
  ) item
  join public.i_warehouse warehouse
    on item->>'id' ~ '^[0-9]+$'
   and warehouse.id = (item->>'id')::bigint
   and warehouse.whse_code = item->>'whse_code'
  where farm.id = 61
    and warehouse.id = any(expected_warehouse_ids)
    and (warehouse.farm_id is null or warehouse.farm_id = farm.id);

  if warehouse_reference_count <> cardinality(expected_warehouse_ids)
     or matched_warehouse_count <> cardinality(expected_warehouse_ids) then
    raise exception 'Repair stopped: Farm 61 warehouse references no longer match the expected warehouse rows.';
  end if;

  update public.i_warehouse warehouse
  set farm_id = farm.id,
      farm_code = farm.code,
      farm_name = farm.name,
      is_default_feed_warehouse = coalesce((item->>'is_default_feed')::boolean, false),
      is_default_receiving_warehouse = coalesce((item->>'is_default_receiving')::boolean, false),
      is_default_disposal_warehouse = coalesce((item->>'is_default_disposal')::boolean, false)
  from public.farms farm
  cross join lateral jsonb_array_elements(
    coalesce(to_jsonb(farm.associated_warehouses), '[]'::jsonb)
  ) item
  where farm.id = 61
    and item->>'id' ~ '^[0-9]+$'
    and warehouse.id = (item->>'id')::bigint
    and warehouse.id = any(expected_warehouse_ids)
    and warehouse.whse_code = item->>'whse_code'
    and (warehouse.farm_id is null or warehouse.farm_id = farm.id);

  get diagnostics updated_warehouse_count = row_count;

  if updated_warehouse_count <> cardinality(expected_warehouse_ids) then
    raise exception 'Repair stopped: expected to update 6 warehouses, updated %.', updated_warehouse_count;
  end if;
end;
$$;

commit;
