begin;

create or replace function public.save_br_delivery_transaction(p_document jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_document_id bigint;
  v_existing_status text;
  v_target_status text := coalesce(nullif(trim(p_document->>'status'), ''), 'Draft');
  v_farm_id bigint := nullif(p_document->>'farmId', '')::bigint;
  v_farm_code text;
  v_farm_name text;
  v_line jsonb;
  v_line_id bigint;
  v_line_no integer := 0;
  v_header jsonb;
  v_lines jsonb;
begin
  if v_actor is null then
    raise exception 'An authenticated user is required to save Harvest & Delivery.';
  end if;

  if v_target_status not in ('Draft', 'Posted') then
    raise exception 'Harvest & Delivery can only be saved as Draft or Posted.';
  end if;

  select farm.code, farm.name
  into v_farm_code, v_farm_name
  from public.farms farm
  where farm.id = v_farm_id;

  if not found then
    raise exception 'Harvest & Delivery requires a valid farm.';
  end if;

  if jsonb_typeof(p_document->'lines') is distinct from 'array'
     or jsonb_array_length(p_document->'lines') = 0 then
    raise exception 'Harvest & Delivery requires at least one line.';
  end if;

  if nullif(p_document->>'id', '') is not null then
    v_document_id := (p_document->>'id')::bigint;

    select delivery.status
    into v_existing_status
    from public.br_delivery delivery
    where delivery.id = v_document_id
    for update;

    if not found then
      raise exception 'Harvest & Delivery document % was not found.', v_document_id;
    end if;

    if v_existing_status <> 'Draft' then
      raise exception 'Only draft Harvest & Delivery documents can be edited or posted.';
    end if;

    update public.br_delivery
    set
      gi_no = trim(p_document->>'giNo'),
      issue_date = (p_document->>'issueDate')::date,
      farm_id = v_farm_id,
      farm_code = nullif(trim(v_farm_code), ''),
      farm_name = nullif(trim(v_farm_name), ''),
      from_warehouse_id = nullif(p_document->>'fromWarehouseId', '')::bigint,
      from_warehouse_code = nullif(trim(p_document->>'fromWarehouseCode'), ''),
      from_warehouse_name = nullif(trim(p_document->>'fromWarehouseName'), ''),
      triggered_by = 'BR-DR',
      remarks = nullif(trim(p_document->>'remarks'), ''),
      status = 'Draft',
      updated_by = v_actor
    where id = v_document_id;
  else
    insert into public.br_delivery (
      gi_no,
      issue_date,
      farm_id,
      farm_code,
      farm_name,
      from_warehouse_id,
      from_warehouse_code,
      from_warehouse_name,
      triggered_by,
      remarks,
      status,
      created_by
    ) values (
      trim(p_document->>'giNo'),
      (p_document->>'issueDate')::date,
      v_farm_id,
      nullif(trim(v_farm_code), ''),
      nullif(trim(v_farm_name), ''),
      nullif(p_document->>'fromWarehouseId', '')::bigint,
      nullif(trim(p_document->>'fromWarehouseCode'), ''),
      nullif(trim(p_document->>'fromWarehouseName'), ''),
      'BR-DR',
      nullif(trim(p_document->>'remarks'), ''),
      'Draft',
      v_actor
    )
    returning id into v_document_id;
  end if;

  update public.br_delivery_lines
  set
    line_no = -id,
    void = '0',
    updated_by = v_actor
  where br_delivery_id = v_document_id
    and void = '1';

  for v_line in select value from jsonb_array_elements(p_document->'lines')
  loop
    v_line_no := v_line_no + 1;
    v_line_id := case
      when coalesce(v_line->>'id', '') ~ '^[0-9]+$' then (v_line->>'id')::bigint
      else null
    end;

    if v_line_id is not null and exists (
      select 1
      from public.br_delivery_lines existing_line
      where existing_line.id = v_line_id
        and existing_line.br_delivery_id = v_document_id
    ) then
      update public.br_delivery_lines
      set
        line_no = v_line_no,
        allocation_group_key = coalesce(nullif(trim(v_line->>'allocationGroupKey'), ''), v_line_id::text),
        ts_dr_no = nullif(trim(v_line->>'tsDrNo'), ''),
        hauler_name = nullif(trim(v_line->>'haulerName'), ''),
        plate_number = nullif(trim(v_line->>'plateNumber'), ''),
        destination = nullif(trim(v_line->>'destination'), ''),
        live_sales_customer_name = nullif(trim(v_line->>'liveSalesCustomerName'), ''),
        truck_seal = nullif(v_line->>'truckSeal', '')::numeric,
        item_id = nullif(v_line->>'itemId', '')::bigint,
        item_code = trim(v_line->>'itemCode'),
        description = nullif(trim(v_line->>'description'), ''),
        batch_rule_id = nullif(v_line->>'batchRuleId', '')::bigint,
        batch_number = nullif(trim(v_line->>'batchNumber'), ''),
        manufacturing_date = nullif(v_line->>'manufacturingDate', '')::date,
        expiry_date = nullif(v_line->>'expiryDate', '')::date,
        alt_qty = (v_line->>'altQty')::numeric,
        alt_uom = trim(v_line->>'altUom'),
        base_qty = (v_line->>'baseQty')::numeric,
        base_uom = trim(v_line->>'baseUom'),
        from_warehouse_id = nullif(v_line->>'fromWarehouseId', '')::bigint,
        from_warehouse_code = nullif(trim(v_line->>'fromWarehouseCode'), ''),
        from_warehouse_name = nullif(trim(v_line->>'fromWarehouseName'), ''),
        void = '1',
        updated_by = v_actor
      where id = v_line_id;
    else
      insert into public.br_delivery_lines (
        br_delivery_id,
        line_no,
        allocation_group_key,
        ts_dr_no,
        hauler_name,
        plate_number,
        destination,
        live_sales_customer_name,
        truck_seal,
        item_id,
        item_code,
        description,
        batch_rule_id,
        batch_number,
        manufacturing_date,
        expiry_date,
        alt_qty,
        alt_uom,
        base_qty,
        base_uom,
        from_warehouse_id,
        from_warehouse_code,
        from_warehouse_name,
        void,
        created_by
      ) values (
        v_document_id,
        v_line_no,
        coalesce(nullif(trim(v_line->>'allocationGroupKey'), ''), gen_random_uuid()::text),
        nullif(trim(v_line->>'tsDrNo'), ''),
        nullif(trim(v_line->>'haulerName'), ''),
        nullif(trim(v_line->>'plateNumber'), ''),
        nullif(trim(v_line->>'destination'), ''),
        nullif(trim(v_line->>'liveSalesCustomerName'), ''),
        nullif(v_line->>'truckSeal', '')::numeric,
        nullif(v_line->>'itemId', '')::bigint,
        trim(v_line->>'itemCode'),
        nullif(trim(v_line->>'description'), ''),
        nullif(v_line->>'batchRuleId', '')::bigint,
        nullif(trim(v_line->>'batchNumber'), ''),
        nullif(v_line->>'manufacturingDate', '')::date,
        nullif(v_line->>'expiryDate', '')::date,
        (v_line->>'altQty')::numeric,
        trim(v_line->>'altUom'),
        (v_line->>'baseQty')::numeric,
        trim(v_line->>'baseUom'),
        nullif(v_line->>'fromWarehouseId', '')::bigint,
        nullif(trim(v_line->>'fromWarehouseCode'), ''),
        nullif(trim(v_line->>'fromWarehouseName'), ''),
        '1',
        v_actor
      );
    end if;
  end loop;

  if v_target_status = 'Posted' then
    perform pg_advisory_xact_lock(hashtextextended('BR_DELIVERY_INVENTORY_POST', 0));

    update public.br_delivery
    set status = 'Posted', updated_by = v_actor
    where id = v_document_id;
  end if;

  select to_jsonb(delivery)
  into v_header
  from public.br_delivery delivery
  where delivery.id = v_document_id;

  select coalesce(jsonb_agg(to_jsonb(line) order by line.line_no), '[]'::jsonb)
  into v_lines
  from public.br_delivery_lines line
  where line.br_delivery_id = v_document_id
    and line.void = '1';

  return jsonb_build_object('header', v_header, 'lines', v_lines);
end;
$$;

revoke all on function public.save_br_delivery_transaction(jsonb) from public;
revoke all on function public.save_br_delivery_transaction(jsonb) from anon;
grant execute on function public.save_br_delivery_transaction(jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
