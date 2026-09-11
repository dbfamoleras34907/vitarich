-- Focused replacement for databases still validating a Feed Type subgroup.
-- Requires existing Growing tables and the current item-based application.
-- p_feed_type_id is retained for RPC compatibility and carries public.items.id.
begin;

create or replace function public.save_brd_fc_feed_intake(
  p_line_id bigint,
  p_feed_kg numeric,
  p_feed_bird numeric,
  p_feed_guideline numeric,
  p_feed_batch_text text,
  p_feed_type_id bigint,
  p_allocations jsonb
)
returns table (id bigint, age integer)
language plpgsql
as $$
declare
  v_line record;
  v_card record;
  v_allocation record;
  v_old_allocation record;
  v_user uuid;
  v_on_hand numeric(18, 6);
  v_ba_id bigint;
  v_expected_allocation_count integer;
  v_saved_allocation_count integer;
  v_invalid_feed_items text;
begin
  if jsonb_typeof(coalesce(p_allocations, '[]'::jsonb)) <> 'array' then
    raise exception 'Unable to save feed intake: allocations must be an array';
  end if;

  v_expected_allocation_count := coalesce(jsonb_array_length(coalesce(p_allocations, '[]'::jsonb)), 0);

  if v_expected_allocation_count = 0 then
    raise exception 'Unable to save feed intake: at least one feed batch is required';
  end if;

  select *
  into v_line
  from public.brd_fc_line line
  where line.id = p_line_id
    and line.void = '1'
  for update;

  if not found then
    raise exception 'Unable to save feed intake: flock card line % was not found', p_line_id;
  end if;

  select *
  into v_card
  from public.brd_fc card
  where card.id = v_line.fc_id
    and card.void = '1';

  if not found then
    raise exception 'Unable to save feed intake: flock card % was not found', v_line.fc_id;
  end if;

  if not exists (
    select 1 from public.farms farm
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(to_jsonb(farm.associated_warehouses)) = 'array'
        then to_jsonb(farm.associated_warehouses) else '[]'::jsonb end
    ) warehouse
    where farm.id = v_card.farm_id
      and warehouse->>'is_default_feed' = 'true'
      and nullif(btrim(warehouse->>'whse_code'), '') = nullif(btrim(v_card.feed_whse_code), '')
  ) then
    raise exception 'Unable to save feed intake: warehouse must be the farm feed warehouse';
  end if;

  -- Keep the RPC argument name for compatibility; its value is now public.items.id.
  if p_feed_type_id is null or not exists (
    select 1 from public.items item
    where item.id = p_feed_type_id and btrim(coalesce(item.void::text, '0')) = '1'
  ) then
    raise exception 'Unable to save feed intake: select an active feed item';
  end if;

  select string_agg(format('item %s, batch %s',
    allocation->>'itemCode', allocation->>'batchNumber'), '; ')
  into v_invalid_feed_items
  from jsonb_array_elements(p_allocations) allocation
  left join public.items item
    on upper(btrim(item.item_code)) = upper(btrim(allocation->>'itemCode'))
  where item.id is distinct from p_feed_type_id
     or btrim(coalesce(item.void::text, '0')) <> '1'
     or nullif(btrim(allocation->>'warehouseCode'), '') is distinct from nullif(btrim(v_card.feed_whse_code), '');

  if v_invalid_feed_items is not null then
    raise exception 'Unable to save feed intake: selected item % must match batches in the document feed warehouse: %',
      p_feed_type_id, v_invalid_feed_items;
  end if;

  v_user := coalesce(auth.uid(), v_line.updated_by, v_line.created_by, v_card.updated_by, v_card.created_by);

  if v_user is null then
    raise exception 'Unable to save feed intake: user is required';
  end if;

  for v_old_allocation in
    select *
    from public.brd_fc_ba
    where fc_line_id = p_line_id
      and void = '1'
    order by line_no
    for update
  loop
    if coalesce(v_old_allocation.alloc_qty, 0) > 0
      and not exists (
        select 1
        from public.inventory_postings ip
        where ip.source_doc_type = 'BRD_FC_FEED_REVERSAL'
          and ip.source_docentry = v_old_allocation.id
      ) then
      insert into public.inventory_postings (
        source_doc_type,
        source_docentry,
        item_code,
        warehouse_code,
        bin_code,
        qty,
        created_by,
        ref_type,
        ref,
        transfer_type,
        ref_type2,
        ref2
      )
      values (
        'BRD_FC_FEED_REVERSAL',
        v_old_allocation.id,
        v_old_allocation.item_code,
        v_old_allocation.whse_code,
        'MAIN SUB BIN',
        v_old_allocation.alloc_qty,
        v_user,
        'batch_code',
        v_old_allocation.batch_no,
        'IN',
        'FLOCK_CARD',
        v_card.fc_no
      );
    end if;

    update public.brd_fc_ba
    set
      void = '0',
      updated_by = v_user,
      reversed_by = v_user,
      reversed_at = coalesce(reversed_at, now()),
      reversal_reason = 'Replaced from flock card feed intake save'
    where public.brd_fc_ba.id = v_old_allocation.id;
  end loop;

  update public.brd_fc_line
  set
    feed_kg = p_feed_kg,
    feed_bird = p_feed_bird,
    feed_guideline = p_feed_guideline,
    feed_batch_text = nullif(btrim(coalesce(p_feed_batch_text, '')), ''),
    extra = (coalesce(brd_fc_line.extra, '{}'::jsonb) - 'feedTypeId') || (select jsonb_build_object('feedItemId', item.id, 'feedItemCode', item.item_code, 'feedItemName', coalesce(item.item_name, item.description, item.item_code)) from public.items item where item.id = p_feed_type_id),
    is_locked = true,
    updated_by = v_user,
    reversed_at = null,
    reversed_by = null,
    reversal_reason = null
  where brd_fc_line.id = p_line_id
    and brd_fc_line.void = '1';

  for v_allocation in
    select
      allocation.ordinality::integer as line_no,
      nullif(allocation.value->>'itemCode', '') as item_code,
      nullif(allocation.value->>'itemName', '') as item_name,
      nullif(allocation.value->>'batchNumber', '') as batch_no,
      nullif(allocation.value->>'warehouseCode', '') as whse_code,
      nullif(allocation.value->>'warehouseName', '') as whse_name,
      nullif(allocation.value->>'source', '') as source,
      nullif(allocation.value->>'manufacturingDate', '') as mfg_date,
      nullif(allocation.value->>'expiryDate', '') as exp_date,
      nullif(allocation.value->>'itemId', '')::bigint as item_id,
      nullif(allocation.value->>'warehouseId', '')::bigint as whse_id,
      coalesce(nullif(allocation.value->>'allocatedQty', '')::numeric, 0) as alloc_qty,
      coalesce(nullif(allocation.value->>'onHandSnapshot', '')::numeric, 0) as onhand_snapshot
    from jsonb_array_elements(coalesce(p_allocations, '[]'::jsonb)) with ordinality as allocation(value, ordinality)
  loop
    if v_allocation.item_code is null then
      raise exception 'Unable to save feed intake: item_code is required';
    end if;

    if v_allocation.whse_code is null then
      raise exception 'Unable to save feed intake: warehouse is required';
    end if;

    if v_allocation.batch_no is null then
      raise exception 'Unable to save feed intake: batch_no is required';
    end if;

    if coalesce(v_allocation.alloc_qty, 0) <= 0 then
      raise exception 'Unable to save feed intake: allocation quantity must be greater than zero';
    end if;

    select coalesce(sum(case when ip.transfer_type = 'OUT' then -ip.qty else ip.qty end), 0)
    into v_on_hand
    from public.inventory_postings ip
    where ip.item_code = v_allocation.item_code
      and ip.warehouse_code = v_allocation.whse_code
      and ip.ref is not distinct from v_allocation.batch_no;

    if v_allocation.alloc_qty > v_on_hand then
      raise exception 'Flock card feed usage exceeds on-hand inventory for item %, batch %, warehouse %.',
        v_allocation.item_code, v_allocation.batch_no, v_allocation.whse_code;
    end if;

    insert into public.brd_fc_ba (
      created_by,
      updated_by,
      fc_line_id,
      line_no,
      item_id,
      item_code,
      item_name,
      batch_no,
      whse_id,
      whse_code,
      whse_name,
      alloc_qty,
      onhand_snapshot,
      mfg_date,
      exp_date,
      source,
      void
    )
    values (
      v_user,
      v_user,
      p_line_id,
      v_allocation.line_no,
      v_allocation.item_id,
      v_allocation.item_code,
      v_allocation.item_name,
      v_allocation.batch_no,
      v_allocation.whse_id,
      v_allocation.whse_code,
      v_allocation.whse_name,
      v_allocation.alloc_qty,
      greatest(v_allocation.onhand_snapshot, v_on_hand),
      v_allocation.mfg_date::date,
      v_allocation.exp_date::date,
      coalesce(nullif(v_allocation.source, ''), 'MANUAL'),
      '1'
    )
    returning public.brd_fc_ba.id into v_ba_id;

    insert into public.inventory_postings (
      source_doc_type,
      source_docentry,
      item_code,
      warehouse_code,
      bin_code,
      qty,
      created_by,
      ref_type,
      ref,
      transfer_type,
      ref_type2,
      ref2
    )
    values (
      'BRD_FC_FEED_USAGE',
      v_ba_id,
      v_allocation.item_code,
      v_allocation.whse_code,
      'MAIN SUB BIN',
      v_allocation.alloc_qty,
      v_user,
      'batch_code',
      v_allocation.batch_no,
      'OUT',
      'FLOCK_CARD',
      v_card.fc_no
    );
  end loop;

  select count(*)::integer
  into v_saved_allocation_count
  from public.brd_fc_ba ba
  where ba.fc_line_id = p_line_id
    and ba.void = '1';

  if v_saved_allocation_count <> v_expected_allocation_count then
    raise exception 'Unable to save feed intake: expected % feed batch allocations but saved %.',
      v_expected_allocation_count, v_saved_allocation_count;
  end if;

  return query
  select public.brd_fc_line.id, public.brd_fc_line.age
  from public.brd_fc_line
  where public.brd_fc_line.id = p_line_id;
end;
$$;

notify pgrst, 'reload schema';
commit;

