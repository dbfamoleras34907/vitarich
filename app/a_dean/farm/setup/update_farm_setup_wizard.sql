create or replace function public.update_farm_setup_wizard(
  p_farm_id bigint,
  payload jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  warehouse_item jsonb;
  warehouse_id bigint;
  father_warehouse_id bigint;
  existing_warehouse_farm_id bigint;
  existing_warehouse_code text;
  existing_warehouse_name text;
  warehouse_id_by_client_key jsonb := '{}'::jsonb;
  associated_warehouse_items jsonb[] := array[]::jsonb[];
  farm_address text;
begin
  if auth.uid() is null or not (
    public.current_user_has_farm_permission('/a_dean/farm')
    or public.current_user_has_farm_permission('/a_dean/farm/edit')
    or public.current_user_has_farm_permission('/a_dean/farm/setup/edit')
    or public.current_user_has_farm_permission('/a_dean/farm/setup/insert')
    or public.current_user_has_farm_permission('/a_dean/farm/setup/approval')
  ) then
    raise exception 'You do not have permission to edit farms.';
  end if;

  if not exists (
    select 1 from public.farms
    where id = p_farm_id and coalesce(approval_status, 'approved') = 'approved'
  ) then
    raise exception 'Farm not found or is not available for editing.';
  end if;

  if jsonb_array_length(coalesce(payload->'warehouses', '[]'::jsonb)) = 0 then
    raise exception 'At least one warehouse must remain assigned to the farm.';
  end if;

  if not exists (
    select 1 from jsonb_array_elements(payload->'warehouses') item
    where coalesce((item->>'is_default_feed')::boolean, false)
  ) or not exists (
    select 1 from jsonb_array_elements(payload->'warehouses') item
    where coalesce((item->>'is_default_receiving')::boolean, false)
  ) or not exists (
    select 1 from jsonb_array_elements(payload->'warehouses') item
    where coalesce((item->>'is_default_disposal')::boolean, false)
  ) then
    raise exception 'Default feed, receiving, and disposal warehouses are required.';
  end if;

  farm_address := nullif(concat_ws(
    ', ',
    nullif(payload->'address'->>'address', ''),
    nullif(payload->'address'->>'barangay', ''),
    nullif(payload->'address'->>'city', ''),
    nullif(payload->'address'->>'province', '')
  ), '');

  update public.farms
  set code = payload->'farm'->>'code',
      name = payload->'farm'->>'name',
      tin = payload->'farm'->>'tin',
      tel = payload->'farm'->>'tel',
      contact_person = payload->'farm'->>'contact_person',
      contact_number = payload->'farm'->>'contact_number',
      farm_type = payload->'farm'->>'farm_type',
      production_model = case when payload->'farm' ? 'production_model' then nullif(payload->'farm'->>'production_model', '') else production_model end,
      island = case when payload->'farm' ? 'island' then nullif(payload->'farm'->>'island', '') else island end,
      administrative_region = case when payload->'farm' ? 'administrative_region' then nullif(payload->'farm'->>'administrative_region', '') else administrative_region end,
      ref = payload->'farm'->>'ref',
      ref_type = payload->'farm'->>'ref_type',
      address = farm_address,
      region = nullif(payload->'address'->>'province', ''),
      updated_at = now()
  where id = p_farm_id;

  -- Omitted warehouses are unassigned, never voided.
  update public.i_warehouse
  set farm_id = null,
      farm_code = null,
      farm_name = null,
      father_id = case when warehouse_type = 'Pen' then null else father_id end,
      is_default_feed_warehouse = false,
      is_default_receiving_warehouse = false,
      is_default_disposal_warehouse = false
  where farm_id = p_farm_id;

  -- Save parents first so new pens can resolve their new parent IDs.
  for warehouse_item in
    select value from jsonb_array_elements(payload->'warehouses')
    where coalesce(value->>'warehouse_type', '') <> 'Pen'
  loop
    warehouse_id := nullif(warehouse_item->>'id', '')::bigint;

    if warehouse_id is null then
      -- A stale ID sequence may hit imported rows. Retry with the next generated ID.
      loop
        insert into public.i_warehouse (
          whse_name, fms_type, warehouse_type, capacity, full_location_code,
          addr1, addr2, city, province, address, phone, mobile, remarks, is_active,
          farm_id, farm_code, farm_name
        ) values (
          warehouse_item->>'whse_name', warehouse_item->>'fms_type',
          warehouse_item->>'warehouse_type', nullif(warehouse_item->>'capacity', '')::numeric,
          warehouse_item->>'full_location_code', warehouse_item->>'addr1',
          warehouse_item->>'addr2', warehouse_item->>'city', warehouse_item->>'province',
          warehouse_item->>'address', warehouse_item->>'phone', warehouse_item->>'mobile',
          warehouse_item->>'remarks', coalesce((warehouse_item->>'is_active')::boolean, true),
          p_farm_id, payload->'farm'->>'code', payload->'farm'->>'name'
        )
        on conflict on constraint i_warehouse_pkey do nothing
        returning id into warehouse_id;
        exit when found;
      end loop;
    else
      existing_warehouse_farm_id := null;
      existing_warehouse_code := null;
      existing_warehouse_name := null;
      select farm_id, whse_code, whse_name
      into existing_warehouse_farm_id, existing_warehouse_code, existing_warehouse_name
      from public.i_warehouse
      where id = warehouse_id
      for update;

      if not found then
        raise exception 'Warehouse internal ID % does not exist.', warehouse_id;
      end if;

      if existing_warehouse_farm_id is not null
         and existing_warehouse_farm_id <> p_farm_id then
        raise exception 'Warehouse % - % (internal ID %) is assigned to farm %.',
          coalesce(existing_warehouse_code, '[no code]'),
          coalesce(existing_warehouse_name, '[unnamed]'),
          warehouse_id,
          existing_warehouse_farm_id;
      end if;

      update public.i_warehouse
      set whse_name = warehouse_item->>'whse_name',
          fms_type = warehouse_item->>'fms_type',
          warehouse_type = warehouse_item->>'warehouse_type',
          capacity = nullif(warehouse_item->>'capacity', '')::numeric,
          full_location_code = warehouse_item->>'full_location_code',
          addr1 = warehouse_item->>'addr1',
          addr2 = warehouse_item->>'addr2',
          city = warehouse_item->>'city',
          province = warehouse_item->>'province',
          address = warehouse_item->>'address',
          phone = warehouse_item->>'phone',
          mobile = warehouse_item->>'mobile',
          remarks = warehouse_item->>'remarks',
          farm_id = p_farm_id,
          farm_code = payload->'farm'->>'code',
          farm_name = payload->'farm'->>'name'
      where id = warehouse_id;
    end if;

    warehouse_id_by_client_key := warehouse_id_by_client_key ||
      jsonb_build_object(warehouse_item->>'client_key', warehouse_id);

    update public.i_warehouse
    set is_default_feed_warehouse = coalesce((warehouse_item->>'is_default_feed')::boolean, false),
        is_default_receiving_warehouse = coalesce((warehouse_item->>'is_default_receiving')::boolean, false),
        is_default_disposal_warehouse = coalesce((warehouse_item->>'is_default_disposal')::boolean, false)
    where id = warehouse_id;

    associated_warehouse_items := array_append(associated_warehouse_items, jsonb_build_object(
      'id', warehouse_id,
      'whse_code', (select whse_code from public.i_warehouse where id = warehouse_id),
      'whse_name', warehouse_item->>'whse_name',
      'is_default_feed', coalesce((warehouse_item->>'is_default_feed')::boolean, false),
      'is_default_receiving', coalesce((warehouse_item->>'is_default_receiving')::boolean, false),
      'is_default_disposal', coalesce((warehouse_item->>'is_default_disposal')::boolean, false)
    ));
  end loop;

  for warehouse_item in
    select value from jsonb_array_elements(payload->'warehouses')
    where value->>'warehouse_type' = 'Pen'
  loop
    warehouse_id := nullif(warehouse_item->>'id', '')::bigint;
    father_warehouse_id := nullif(
      warehouse_id_by_client_key->>(warehouse_item->>'father_client_key'), ''
    )::bigint;

    if father_warehouse_id is null then
      raise exception 'Every pen must belong to an assigned building.';
    end if;

    if warehouse_id is null then
      -- A stale ID sequence may hit imported rows. Retry with the next generated ID.
      loop
        insert into public.i_warehouse (
          whse_name, fms_type, warehouse_type, capacity, father_id, is_active,
          farm_id, farm_code, farm_name
        ) values (
          warehouse_item->>'whse_name', warehouse_item->>'fms_type', 'Pen',
          nullif(warehouse_item->>'capacity', '')::numeric, father_warehouse_id,
          coalesce((warehouse_item->>'is_active')::boolean, true),
          p_farm_id, payload->'farm'->>'code', payload->'farm'->>'name'
        )
        on conflict on constraint i_warehouse_pkey do nothing
        returning id into warehouse_id;
        exit when found;
      end loop;
    else
      existing_warehouse_farm_id := null;
      existing_warehouse_code := null;
      existing_warehouse_name := null;
      select farm_id, whse_code, whse_name
      into existing_warehouse_farm_id, existing_warehouse_code, existing_warehouse_name
      from public.i_warehouse
      where id = warehouse_id
      for update;

      if not found then
        raise exception 'Warehouse internal ID % does not exist.', warehouse_id;
      end if;

      if existing_warehouse_farm_id is not null
         and existing_warehouse_farm_id <> p_farm_id then
        raise exception 'Warehouse % - % (internal ID %) is assigned to farm %.',
          coalesce(existing_warehouse_code, '[no code]'),
          coalesce(existing_warehouse_name, '[unnamed]'),
          warehouse_id,
          existing_warehouse_farm_id;
      end if;

      update public.i_warehouse
      set whse_name = warehouse_item->>'whse_name',
          fms_type = warehouse_item->>'fms_type',
          capacity = nullif(warehouse_item->>'capacity', '')::numeric,
          father_id = father_warehouse_id,
          farm_id = p_farm_id,
          farm_code = payload->'farm'->>'code',
          farm_name = payload->'farm'->>'name'
      where id = warehouse_id;
    end if;

    associated_warehouse_items := array_append(associated_warehouse_items, jsonb_build_object(
      'id', warehouse_id,
      'whse_code', (select whse_code from public.i_warehouse where id = warehouse_id),
      'whse_name', warehouse_item->>'whse_name',
      'father_id', father_warehouse_id,
      'is_default_feed', false,
      'is_default_receiving', false,
      'is_default_disposal', false
    ));
  end loop;

  update public.farms
  set associated_warehouses = associated_warehouse_items
  where id = p_farm_id;

  return p_farm_id;
end;
$$;

revoke all on function public.update_farm_setup_wizard(bigint, jsonb) from public;
grant execute on function public.update_farm_setup_wizard(bigint, jsonb) to authenticated;
