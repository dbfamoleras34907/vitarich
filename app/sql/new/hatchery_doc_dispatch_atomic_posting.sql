-- Atomic DOC Dispatch persistence and posting. Apply after the existing
-- dispatch_doc notification/posting trigger migration.
begin;

create or replace function public.save_hatchery_dispatch_transaction_atomic(
  p_id bigint,
  p_payload jsonb,
  p_actor uuid,
  p_post boolean
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint := p_id;
  v_destination public.farms%rowtype;
  v_line record;
  v_source_qty numeric;
  v_dispatched_qty numeric;
  v_expected_classification public.sku_classification;
  v_posted_id bigint;
  v_current_status text;
  v_current_is_active boolean;
begin
  if not exists (
    select 1 from public.users where auth_id = p_actor and isactive::text = '1'
  ) then
    raise exception 'Active actor required';
  end if;

  select * into v_destination
  from public.farms
  where code = p_payload->>'destination_farm_code'
    and upper(farm_type) = 'BR'
    and void::text = '1'
    and approval_status = 'approved';
  if not found then
    raise exception 'Active Broiler destination is required';
  end if;

  if jsonb_typeof(p_payload->'items') is distinct from 'array'
     or jsonb_array_length(p_payload->'items') = 0 then
    raise exception 'At least one DOC Dispatch item is required';
  end if;

  -- Serializes availability checks for the selected grading batches. The
  -- remaining balance is calculated after this lock, so concurrent postings
  -- cannot both consume the same DOC balance.
  perform 1
  from public.chick_grading_process grading
  where grading.batch_code in (
    select distinct nullif(btrim(value->>'doc_batch_code'), '')
    from jsonb_array_elements(p_payload->'items')
  )
  for update;

  for v_line in
    select
      nullif(btrim(line.doc_batch_code), '') as doc_batch_code,
      nullif(btrim(line.sku_name), '') as sku_name,
      line.classification,
      sum(line.qty) as qty
    from jsonb_to_recordset(p_payload->'items') as line(
      doc_batch_code text,
      sku_name text,
      classification public.sku_classification,
      qty numeric
    )
    group by line.doc_batch_code, line.sku_name, line.classification
  loop
    if v_line.doc_batch_code is null or v_line.sku_name is null
       or v_line.qty is null or v_line.qty <= 0 then
      raise exception 'Every DOC Dispatch line requires a batch, SKU, and positive quantity';
    end if;

    v_expected_classification := case v_line.sku_name
      when 'Class A' then 'SALEABLE'::public.sku_classification
      when 'Class A Junior' then 'BY_PRODUCT'::public.sku_classification
      when 'Class B' then 'BY_PRODUCT'::public.sku_classification
      when 'Class C' then 'BY_PRODUCT'::public.sku_classification
      when 'Infertile' then 'BY_PRODUCT'::public.sku_classification
      when 'Live PIP' then 'BY_PRODUCT'::public.sku_classification
      when 'Dead Chick' then 'BY_PRODUCT'::public.sku_classification
      when 'Dead Germ' then 'BY_PRODUCT'::public.sku_classification
      else null
    end;
    if v_expected_classification is null or v_line.classification is distinct from v_expected_classification then
      raise exception 'Invalid SKU or classification for DOC batch %', v_line.doc_batch_code;
    end if;

    select case v_line.sku_name
      when 'Class A' then coalesce(grading.class_a, 0)
      when 'Class A Junior' then coalesce(grading.class_a_junior, 0)
      when 'Class B' then coalesce(grading.class_b, 0)
      when 'Class C' then coalesce(grading.class_c, 0)
      when 'Infertile' then coalesce(grading.infertile, 0)
      when 'Live PIP' then coalesce(grading.live_pip, 0)
      when 'Dead Chick' then coalesce(grading.dead_chicks, 0)
      when 'Dead Germ' then coalesce(grading.dead_germ, 0)
      else null
    end into v_source_qty
    from public.chick_grading_process grading
    where grading.batch_code = v_line.doc_batch_code;
    if v_source_qty is null then
      raise exception 'DOC batch % is not available for dispatch', v_line.doc_batch_code;
    end if;

    select coalesce(sum(item.qty), 0) into v_dispatched_qty
    from public.dispatch_doc_item item
    join public.dispatch_doc dispatch on dispatch.id = item.dispatch_doc_id
    where dispatch.status = 'Posted'
      and dispatch.is_active
      and dispatch.id is distinct from v_id
      and item.doc_batch_code = v_line.doc_batch_code
      and item.sku_name = v_line.sku_name;
    if v_line.qty > v_source_qty - v_dispatched_qty then
      raise exception 'DOC batch % / % has only % remaining',
        v_line.doc_batch_code, v_line.sku_name, greatest(0, v_source_qty - v_dispatched_qty);
    end if;
  end loop;

  if v_id is null then
    insert into public.dispatch_doc(
      doc_date, dr_no, farm_name, destination_farm_id, destination_farm_code,
      address, hauler_name, hauler_plate_no, truck_seal_no, chick_van_temp_c,
      number_of_fans, remarks, status, is_active, created_by
    ) values (
      (p_payload->>'doc_date')::date, p_payload->>'dr_no', v_destination.name,
      v_destination.id, v_destination.code, v_destination.address,
      p_payload->>'hauler_name', p_payload->>'hauler_plate_no', p_payload->>'truck_seal_no',
      (p_payload->>'chick_van_temp_c')::numeric, (p_payload->>'number_of_fans')::integer,
      p_payload->>'remarks', 'Draft', true, p_actor
    ) returning id into v_id;
  else
    update public.dispatch_doc
    set doc_date = (p_payload->>'doc_date')::date,
        dr_no = p_payload->>'dr_no',
        farm_name = v_destination.name,
        destination_farm_id = v_destination.id,
        destination_farm_code = v_destination.code,
        address = v_destination.address,
        hauler_name = p_payload->>'hauler_name',
        hauler_plate_no = p_payload->>'hauler_plate_no',
        truck_seal_no = p_payload->>'truck_seal_no',
        chick_van_temp_c = (p_payload->>'chick_van_temp_c')::numeric,
        number_of_fans = (p_payload->>'number_of_fans')::integer,
        remarks = p_payload->>'remarks',
        updated_at = now(),
        updated_by = p_actor
    where id = v_id and status = 'Draft' and is_active;
    if not found then
      raise exception 'Only an active draft DOC Dispatch can be updated';
    end if;
  end if;

  delete from public.dispatch_doc_item where dispatch_doc_id = v_id;
  insert into public.dispatch_doc_item(
    dispatch_doc_id, doc_batch_code, sku_name, classification, uom, qty, created_by
  )
  select
    v_id,
    nullif(btrim(line.doc_batch_code), ''),
    nullif(btrim(line.sku_name), ''),
    line.classification,
    coalesce(line.uom, 'PCS'::public.uom_type),
    line.qty,
    p_actor
  from jsonb_to_recordset(p_payload->'items') as line(
    doc_batch_code text,
    sku_name text,
    classification public.sku_classification,
    uom public.uom_type,
    qty numeric
  );

  if p_post then
    update public.dispatch_doc
    set status = 'Posted', posted_by = p_actor, updated_by = p_actor
    where id = v_id and status = 'Draft' and is_active is true
    returning id into v_posted_id;
    if v_posted_id is null then
      select status, is_active
      into v_current_status, v_current_is_active
      from public.dispatch_doc
      where id = v_id;

      raise exception 'DOC Dispatch % cannot be posted (current status: %, active: %). Only an active Draft may be posted.',
        v_id,
        coalesce(v_current_status, '<missing>'),
        coalesce(v_current_is_active::text, '<missing>');
    end if;
  end if;

  return v_id;
end;
$$;

-- PostgREST cannot reliably select the four-argument overload while the
-- legacy three-argument draft RPC remains deployed. Retire only that
-- conflicting overload; the draft RPC remains available for compatibility.
drop function if exists public.save_hatchery_dispatch_transaction(bigint, jsonb, uuid, boolean);

create or replace function public.post_hatchery_dispatch_transaction(p_id bigint, p_actor uuid)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payload jsonb;
begin
  select jsonb_build_object(
    'doc_date', dispatch.doc_date,
    'dr_no', dispatch.dr_no,
    'farm_name', dispatch.farm_name,
    'destination_farm_code', dispatch.destination_farm_code,
    'address', dispatch.address,
    'hauler_name', dispatch.hauler_name,
    'hauler_plate_no', dispatch.hauler_plate_no,
    'truck_seal_no', dispatch.truck_seal_no,
    'chick_van_temp_c', dispatch.chick_van_temp_c,
    'number_of_fans', dispatch.number_of_fans,
    'remarks', dispatch.remarks,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'doc_batch_code', item.doc_batch_code,
        'sku_name', item.sku_name,
        'classification', item.classification,
        'uom', item.uom,
        'qty', item.qty
      ) order by item.id)
      from public.dispatch_doc_item item
      where item.dispatch_doc_id = dispatch.id
    ), '[]'::jsonb)
  ) into v_payload
  from public.dispatch_doc dispatch
  where dispatch.id = p_id and dispatch.status = 'Draft' and dispatch.is_active;
  if v_payload is null then
    raise exception 'Only an active draft DOC Dispatch can be posted';
  end if;

  return public.save_hatchery_dispatch_transaction_atomic(p_id, v_payload, p_actor, true);
end;
$$;

revoke all on function public.save_hatchery_dispatch_transaction_atomic(bigint, jsonb, uuid, boolean) from public, anon, authenticated;
grant execute on function public.save_hatchery_dispatch_transaction_atomic(bigint, jsonb, uuid, boolean) to service_role;
revoke all on function public.post_hatchery_dispatch_transaction(bigint, uuid) from public, anon, authenticated;
grant execute on function public.post_hatchery_dispatch_transaction(bigint, uuid) to service_role;

notify pgrst, 'reload schema';
commit;
