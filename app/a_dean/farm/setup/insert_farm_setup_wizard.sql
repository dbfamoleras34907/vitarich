alter table public.farms
  add column if not exists approval_status text not null default 'approved',
  add column if not exists approval_request_id bigint null,
  add column if not exists approval_submitted_at timestamp with time zone null,
  add column if not exists approval_approved_at timestamp with time zone null,
  add column if not exists approval_rejected_at timestamp with time zone null;

create or replace function public.insert_farm_setup_wizard(payload jsonb)
returns bigint
language plpgsql
as $$
declare
  new_farm_id bigint;
  warehouse_item jsonb;
  machine_item jsonb;
  new_warehouse_id bigint;
  new_warehouse_code text;
  new_warehouse_name text;
  associated_warehouse_items jsonb[] := array[]::jsonb[];
  warehouse_ids bigint[] := array[]::bigint[];
  warehouse_id_by_client_key jsonb := '{}'::jsonb;
  father_warehouse_id bigint;
  farm_address text;
  farm_region text;
  farm_approval_status text;
begin
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

  farm_approval_status := coalesce(nullif(payload->'farm'->>'approval_status', ''), 'approved');

  if exists (
    select 1
    from jsonb_array_elements(coalesce(payload->'warehouses', '[]'::jsonb)) as buildings(building)
    where building->>'warehouse_type' = 'Building'
      and exists (
        select 1
        from jsonb_array_elements(coalesce(payload->'warehouses', '[]'::jsonb)) as pens(pen)
        where pen->>'warehouse_type' = 'Pen'
          and pen->>'father_client_key' = building->>'client_key'
      )
      and (
        nullif(building->>'capacity', '') is null
        or exists (
          select 1
          from jsonb_array_elements(coalesce(payload->'warehouses', '[]'::jsonb)) as pens(pen)
          where pen->>'warehouse_type' = 'Pen'
            and pen->>'father_client_key' = building->>'client_key'
            and nullif(pen->>'capacity', '') is null
        )
        or (building->>'capacity')::numeric <> (
          select sum((pen->>'capacity')::numeric)
          from jsonb_array_elements(coalesce(payload->'warehouses', '[]'::jsonb)) as pens(pen)
          where pen->>'warehouse_type' = 'Pen'
            and pen->>'father_client_key' = building->>'client_key'
        )
      )
  ) then
    raise exception 'For buildings with pens, the pen capacity total must equal the building capacity.';
  end if;

  for warehouse_item in
    select value
    from jsonb_array_elements(coalesce(payload->'warehouses', '[]'::jsonb))
    where coalesce(value->>'warehouse_type', '') <> 'Pen'
  loop
    insert into public.i_warehouse (
      whse_name,
      fms_type,
      warehouse_type,
      capacity,
      full_location_code,
      addr1,
      addr2,
      city,
      province,
      address,
      phone,
      mobile,
      remarks,
      is_active,
      is_default_feed_warehouse,
      is_default_receiving_warehouse
    )
    values (
      warehouse_item->>'whse_name',
      warehouse_item->>'fms_type',
      warehouse_item->>'warehouse_type',
      nullif(warehouse_item->>'capacity', '')::numeric,
      warehouse_item->>'full_location_code',
      warehouse_item->>'addr1',
      warehouse_item->>'addr2',
      warehouse_item->>'city',
      warehouse_item->>'province',
      warehouse_item->>'address',
      warehouse_item->>'phone',
      warehouse_item->>'mobile',
      warehouse_item->>'remarks',
      coalesce((warehouse_item->>'is_active')::boolean, true),
      coalesce((warehouse_item->>'is_default_feed')::boolean, false),
      coalesce((warehouse_item->>'is_default_receiving')::boolean, false)
    )
    returning id, whse_code, whse_name
    into new_warehouse_id, new_warehouse_code, new_warehouse_name;

    warehouse_ids := array_append(warehouse_ids, new_warehouse_id);
    warehouse_id_by_client_key := warehouse_id_by_client_key || jsonb_build_object(
      warehouse_item->>'client_key',
      new_warehouse_id
    );
    associated_warehouse_items := array_append(
      associated_warehouse_items,
      jsonb_build_object(
        'id', new_warehouse_id,
        'whse_code', new_warehouse_code,
        'whse_name', new_warehouse_name,
        'is_default_feed', coalesce((warehouse_item->>'is_default_feed')::boolean, false),
        'is_default_receiving', coalesce((warehouse_item->>'is_default_receiving')::boolean, false)
      )
    );
  end loop;

  for warehouse_item in
    select value
    from jsonb_array_elements(coalesce(payload->'warehouses', '[]'::jsonb))
    where value->>'warehouse_type' = 'Pen'
  loop
    father_warehouse_id := nullif(
      warehouse_id_by_client_key->>(warehouse_item->>'father_client_key'),
      ''
    )::bigint;

    if father_warehouse_id is null then
      raise exception 'Pen % does not reference a Building in this setup.', warehouse_item->>'whse_name';
    end if;

    insert into public.i_warehouse (
      whse_name,
      fms_type,
      warehouse_type,
      capacity,
      father_id,
      is_active,
      is_default_feed_warehouse,
      is_default_receiving_warehouse
    )
    values (
      warehouse_item->>'whse_name',
      warehouse_item->>'fms_type',
      'Pen',
      nullif(warehouse_item->>'capacity', '')::numeric,
      father_warehouse_id,
      coalesce((warehouse_item->>'is_active')::boolean, true),
      false,
      false
    )
    returning id, whse_code, whse_name
    into new_warehouse_id, new_warehouse_code, new_warehouse_name;

    warehouse_ids := array_append(warehouse_ids, new_warehouse_id);
    associated_warehouse_items := array_append(
      associated_warehouse_items,
      jsonb_build_object(
        'id', new_warehouse_id,
        'whse_code', new_warehouse_code,
        'whse_name', new_warehouse_name,
        'father_id', father_warehouse_id,
        'is_default_feed', false,
        'is_default_receiving', false
      )
    );
  end loop;

  insert into public.farms (
    code,
    name,
    tin,
    tel,
    contact_person,
    contact_number,
    farm_type,
    address,
    region,
    associated_warehouses,
    approval_status,
    approval_submitted_at
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
    end,
    farm_approval_status,
    case when farm_approval_status = 'pending' then now() else null end
  )
  returning id into new_farm_id;

  update public.i_warehouse
  set
    farm_id = new_farm_id,
    farm_code = payload->'farm'->>'code',
    farm_name = payload->'farm'->>'name'
  where id = any(warehouse_ids);

  for machine_item in
    select * from jsonb_array_elements(coalesce(payload->'machines', '[]'::jsonb))
  loop
    insert into public.farm_machines (
      farm_id,
      code,
      name,
      type,
      capacity,
      remarks
    )
    values (
      new_farm_id,
      machine_item->'data'->>'code',
      machine_item->'data'->>'name',
      machine_item->'data'->>'type',
      nullif(machine_item->'data'->>'capacity', '')::numeric,
      machine_item->'data'->>'remarks'
    );
  end loop;

  return new_farm_id;
end;
$$;
