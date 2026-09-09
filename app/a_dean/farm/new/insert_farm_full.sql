create or replace function public.insert_farm_full(payload jsonb)
returns bigint
language plpgsql
as $$
declare
  new_farm_id bigint;
  b jsonb;
  p jsonb;
  m jsonb;
  new_building_id bigint;
  associated_warehouse_items jsonb[];
  farm_address text;
  farm_region text;
begin
  select coalesce(array_agg(warehouse_item), array[]::jsonb[])
  into associated_warehouse_items
  from jsonb_array_elements(coalesce(payload->'associated_warehouses', '[]'::jsonb)) as warehouse_items(warehouse_item);

  farm_address := nullif(
    concat_ws(
      ', ',
      nullif(payload->'address'->>'address', ''),
      nullif(payload->'address'->>'barangay', ''),
      nullif(payload->'address'->>'city', ''),
      nullif(payload->'address'->>'province', '')
    ),
    ''
  );

  farm_region := coalesce(
    nullif(payload->'farm'->>'region', ''),
    nullif(payload->'address'->>'province', '')
  );

  insert into farms (
    code,
    name,
    tin,
    tel,
    contact_person,
    contact_number,
    farm_type,
    address,
    region,
    associated_warehouses
  )
  values (
    payload->'farm'->>'code',
    payload->'farm'->>'name',
    payload->'farm'->>'tin',
    payload->'farm'->>'tel',
    payload->'farm'->>'contact_person',
    payload->'farm'->>'contact_number',
    payload->'farm'->>'farm_type',
    farm_address,
    farm_region,
    case
      when cardinality(associated_warehouse_items) = 0 then null
      else associated_warehouse_items
    end
  )
  returning id into new_farm_id;

  update public.i_warehouse w
  set
    farm_id = new_farm_id,
    farm_code = payload->'farm'->>'code',
    farm_name = payload->'farm'->>'name',
    is_default_feed_warehouse = coalesce((warehouse_item->>'is_default_feed')::boolean, false),
    is_default_receiving_warehouse = coalesce((warehouse_item->>'is_default_receiving')::boolean, false)
  from unnest(associated_warehouse_items) as warehouse_items(warehouse_item)
  where w.whse_code = warehouse_item->>'whse_code';

  for b in
    select * from jsonb_array_elements(coalesce(payload->'buildings', '[]'::jsonb))
  loop
    insert into farm_buildings (
      farm_id,
      code,
      name,
      status,
      remarks
    )
    values (
      new_farm_id,
      b->'data'->>'code',
      b->'data'->>'name',
      b->'data'->>'status',
      b->'data'->>'remarks'
    )
    returning id into new_building_id;

    for p in
      select * from jsonb_array_elements(coalesce(b->'pens', '[]'::jsonb))
    loop
      insert into farm_pens (
        building_id,
        code,
        name,
        status
      )
      values (
        new_building_id,
        p->'data'->>'code',
        p->'data'->>'name',
        p->'data'->>'status'
      );
    end loop;
  end loop;

  for m in
    select * from jsonb_array_elements(coalesce(payload->'machines', '[]'::jsonb))
  loop
    insert into farm_machines (
      farm_id,
      code,
      name,
      type,
      capacity,
      remarks
    )
    values (
      new_farm_id,
      m->'data'->>'code',
      m->'data'->>'name',
      m->'data'->>'type',
      nullif(m->'data'->>'capacity', '')::numeric,
      m->'data'->>'remarks'
    );
  end loop;

  return new_farm_id;
end;
$$;
