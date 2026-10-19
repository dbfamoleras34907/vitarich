begin;

create or replace function public.save_goods_issue_transaction(p_document jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_document_id bigint := nullif(p_document->>'id', '')::bigint;
  v_existing_status text;
  v_target_status text := coalesce(nullif(trim(p_document->>'status'), ''), 'Draft');
  v_farm_id bigint := nullif(p_document->>'farmId', '')::bigint;
  v_farm_code text;
  v_farm_name text;
  v_year_suffix text;
  v_next_number bigint;
  v_document_no text;
  v_line jsonb;
  v_line_id bigint;
  v_line_no integer := 0;
  v_header jsonb;
  v_lines jsonb;
begin
  if v_actor is null then
    raise exception 'An authenticated user is required to save Item Stock Out.';
  end if;

  if v_target_status not in ('Draft', 'Posted') then
    raise exception 'Item Stock Out can only be saved as Draft or Posted.';
  end if;

  if jsonb_typeof(p_document->'lines') is distinct from 'array'
     or jsonb_array_length(p_document->'lines') = 0 then
    raise exception 'Item Stock Out requires at least one line.';
  end if;

  select farm.code, farm.name
  into v_farm_code, v_farm_name
  from public.farms farm
  where farm.id = v_farm_id;

  if not found then
    raise exception 'Item Stock Out requires a valid farm.';
  end if;

  if v_document_id is not null then
    select issue.status, issue.gi_no
    into v_existing_status, v_document_no
    from public.goods_issue issue
    where issue.id = v_document_id
    for update;

    if not found then
      raise exception 'Item Stock Out document % was not found.', v_document_id;
    end if;

    if v_existing_status <> 'Draft' then
      raise exception 'Only draft Item Stock Out documents can be edited or posted.';
    end if;

    update public.goods_issue
    set
      issue_date = (p_document->>'issueDate')::date,
      farm_id = v_farm_id,
      farm_code = nullif(trim(v_farm_code), ''),
      farm_name = nullif(trim(v_farm_name), ''),
      from_warehouse_id = nullif(p_document->>'fromWarehouseId', '')::bigint,
      from_warehouse_code = nullif(trim(p_document->>'fromWarehouseCode'), ''),
      from_warehouse_name = nullif(trim(p_document->>'fromWarehouseName'), ''),
      triggered_by = 'GI',
      remarks = nullif(trim(p_document->>'remarks'), ''),
      status = 'Draft',
      updated_by = v_actor
    where id = v_document_id;
  else
    v_year_suffix := to_char(now() at time zone 'Asia/Manila', 'YY');
    perform pg_advisory_xact_lock(hashtextextended('GOODS_ISSUE_NUMBER:' || v_year_suffix, 0));

    select coalesce(max(substring(issue.gi_no from '([0-9]+)$')::bigint), 0) + 1
    into v_next_number
    from public.goods_issue issue
    where issue.gi_no ~ ('^GI-' || v_year_suffix || '-[0-9]+$');

    v_document_no := format('GI-%s-%s', v_year_suffix, lpad(v_next_number::text, 6, '0'));

    insert into public.goods_issue (
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
      v_document_no,
      (p_document->>'issueDate')::date,
      v_farm_id,
      nullif(trim(v_farm_code), ''),
      nullif(trim(v_farm_name), ''),
      nullif(p_document->>'fromWarehouseId', '')::bigint,
      nullif(trim(p_document->>'fromWarehouseCode'), ''),
      nullif(trim(p_document->>'fromWarehouseName'), ''),
      'GI',
      nullif(trim(p_document->>'remarks'), ''),
      'Draft',
      v_actor
    )
    returning id into v_document_id;
  end if;

  update public.goods_issue_items
  set line_no = -id,
      updated_by = v_actor
  where goods_issue_id = v_document_id
    and void = '1';

  for v_line in
    select value from jsonb_array_elements(p_document->'lines')
  loop
    v_line_no := v_line_no + 1;
    v_line_id := case
      when coalesce(v_line->>'id', '') ~ '^[0-9]+$' then (v_line->>'id')::bigint
      else null
    end;

    if v_line_id is not null and exists (
      select 1
      from public.goods_issue_items item
      where item.id = v_line_id
        and item.goods_issue_id = v_document_id
    ) then
      update public.goods_issue_items
      set
        line_no = v_line_no,
        item_id = nullif(v_line->>'itemId', '')::bigint,
        item_code = trim(v_line->>'itemCode'),
        description = nullif(trim(v_line->>'description'), ''),
        allocation_group_key = coalesce(nullif(trim(v_line->>'allocationGroupKey'), ''), v_line_id::text),
        batch_rule_id = nullif(v_line->>'batchRuleId', '')::bigint,
        batch_number = nullif(trim(v_line->>'batchNumber'), ''),
        manufacturing_date = nullif(v_line->>'manufacturingDate', '')::date,
        expiry_date = nullif(v_line->>'expiryDate', '')::date,
        alt_qty = coalesce(nullif(v_line->>'altQty', '')::numeric, 0),
        alt_uom = trim(v_line->>'altUom'),
        base_qty = coalesce(nullif(v_line->>'baseQty', '')::numeric, 0),
        base_uom = trim(v_line->>'baseUom'),
        from_warehouse_id = nullif(v_line->>'fromWarehouseId', '')::bigint,
        from_warehouse_code = nullif(trim(v_line->>'fromWarehouseCode'), ''),
        from_warehouse_name = nullif(trim(v_line->>'fromWarehouseName'), ''),
        void = '1',
        updated_by = v_actor
      where id = v_line_id;
    else
      insert into public.goods_issue_items (
        goods_issue_id,
        line_no,
        item_id,
        item_code,
        description,
        allocation_group_key,
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
        nullif(v_line->>'itemId', '')::bigint,
        trim(v_line->>'itemCode'),
        nullif(trim(v_line->>'description'), ''),
        coalesce(nullif(trim(v_line->>'allocationGroupKey'), ''), gen_random_uuid()::text),
        nullif(v_line->>'batchRuleId', '')::bigint,
        nullif(trim(v_line->>'batchNumber'), ''),
        nullif(v_line->>'manufacturingDate', '')::date,
        nullif(v_line->>'expiryDate', '')::date,
        coalesce(nullif(v_line->>'altQty', '')::numeric, 0),
        trim(v_line->>'altUom'),
        coalesce(nullif(v_line->>'baseQty', '')::numeric, 0),
        trim(v_line->>'baseUom'),
        nullif(v_line->>'fromWarehouseId', '')::bigint,
        nullif(trim(v_line->>'fromWarehouseCode'), ''),
        nullif(trim(v_line->>'fromWarehouseName'), ''),
        '1',
        v_actor
      );
    end if;
  end loop;

  update public.goods_issue_items
  set void = '0',
      updated_by = v_actor
  where goods_issue_id = v_document_id
    and void = '1'
    and line_no < 0;

  if v_target_status = 'Posted' then
    update public.goods_issue
    set status = 'Posted',
        updated_by = v_actor
    where id = v_document_id;
  end if;

  select to_jsonb(issue)
  into v_header
  from public.goods_issue issue
  where issue.id = v_document_id;

  select coalesce(jsonb_agg(to_jsonb(item) order by item.line_no), '[]'::jsonb)
  into v_lines
  from public.goods_issue_items item
  where item.goods_issue_id = v_document_id
    and item.void = '1';

  return jsonb_build_object('header', v_header, 'lines', v_lines);
end;
$$;

revoke all on function public.save_goods_issue_transaction(jsonb) from public;
revoke all on function public.save_goods_issue_transaction(jsonb) from anon;
grant execute on function public.save_goods_issue_transaction(jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
