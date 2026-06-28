create or replace function public.update_farm_full(p_farm_id bigint, payload jsonb)
returns bigint
language plpgsql
as $$
declare
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

  update farms
  set
    code = payload->'farm'->>'code',
    name = payload->'farm'->>'name',
    tin = payload->'farm'->>'tin',
    tel = payload->'farm'->>'tel',
    contact_person = payload->'farm'->>'contact_person',
    contact_number = payload->'farm'->>'contact_number',
    farm_type = payload->'farm'->>'farm_type',
    ref = payload->'farm'->>'ref',
    ref_type = payload->'farm'->>'ref_type',
    address = farm_address,
    region = farm_region,
    associated_warehouses = case
      when cardinality(associated_warehouse_items) = 0 then null
      else associated_warehouse_items
    end,
    updated_at = now()
  where id = p_farm_id;

  delete from farm_pens
  where building_id in (
    select id from farm_buildings where farm_id = p_farm_id
  );

  delete from farm_buildings
  where farm_id = p_farm_id;

  delete from farm_machines
  where farm_id = p_farm_id;

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
      p_farm_id,
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
      p_farm_id,
      m->'data'->>'code',
      m->'data'->>'name',
      m->'data'->>'type',
      nullif(m->'data'->>'capacity', '')::numeric,
      m->'data'->>'remarks'
    );
  end loop;

  return p_farm_id;
end;
$$;
