-- Deploy after flock_card_tables.sql and the centralized notification SQL.
-- One RPC transaction: header, all ages, feed allocations and inventory triggers.
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

create table if not exists public.brd_fc_save_requests (
  request_id uuid primary key,
  actor_auth_id uuid not null references auth.users(id),
  payload_hash text not null,
  fc_id bigint not null references public.brd_fc(id),
  is_new boolean not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.brd_fc_save_requests enable row level security;
drop policy if exists brd_fc_save_requests_own on public.brd_fc_save_requests;
create policy brd_fc_save_requests_own on public.brd_fc_save_requests
  for all to authenticated
  using (actor_auth_id = auth.uid()) with check (actor_auth_id = auth.uid());
revoke all on public.brd_fc_save_requests from public, authenticated;
grant select, insert on public.brd_fc_save_requests to authenticated;

create or replace function public.save_brd_fc_transaction(p_request_id uuid, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_hash text := md5(p_payload::text);
  v_request public.brd_fc_save_requests%rowtype;
  v_header public.brd_fc%rowtype;
  v_line public.brd_fc_line%rowtype;
  v_saved_line public.brd_fc_line%rowtype;
  v_farm public.farms%rowtype;
  v_input jsonb;
  v_feed jsonb;
  v_result jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_id bigint := nullif(p_payload->>'id', '')::bigint;
begin
  if v_user is null or p_request_id is null then
    raise exception 'A signed-in user and save request ID are required.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into v_request from public.brd_fc_save_requests where request_id = p_request_id;
  if found then
    if v_request.actor_auth_id <> v_user or v_request.payload_hash <> v_hash then
      raise exception 'Save request ID was already used for a different action.';
    end if;
    return v_request.result;
  end if;
  if jsonb_typeof(p_payload->'lines') is distinct from 'array' then
    raise exception 'Growing lines must be an array.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_payload->'lines') x
    group by (x->>'age')::integer having count(*) > 1
  ) then
    raise exception 'Growing cannot contain duplicate ages.';
  end if;

  select * into v_farm from public.farms
  where id = (p_payload->'header'->>'farm_id')::bigint;
  if not found or coalesce(upper(btrim(v_farm.farm_type)), '') not in ('BR', 'BROILER') then
    raise exception 'A valid Broiler farm is required.';
  end if;
  -- Serialize all saves to this farm before modifying its header/line inventory.
  perform pg_advisory_xact_lock(hashtextextended('BRD_FC_FARM:' || v_farm.id::text, 0));
  if v_id is not null then
    select * into v_header from public.brd_fc where id = v_id and void = '1' for update;
    if not found then raise exception 'Growing record was not found or cannot be edited.'; end if;
    if v_header.farm_id is distinct from v_farm.id then
      raise exception 'The saved Growing farm cannot be changed.';
    end if;
  end if;
  v_header := jsonb_populate_record(v_header, p_payload->'header');
  v_header.farm_id := v_farm.id;
  v_header.farm_code := v_farm.code;
  v_header.farm_name := v_farm.name;
  if v_id is null then
    insert into public.brd_fc (fc_no, card_no, fc_date, farm_id, farm_code, farm_name, building_id, building_whse_id, building_src, building_key, building_code, building_name, building_status, feed_whse_id, feed_whse_code, feed_whse_name, animal_qty, created_by, updated_by, void)
    values (v_header.fc_no, v_header.card_no, v_header.fc_date, v_header.farm_id, v_header.farm_code, v_header.farm_name, v_header.building_id, v_header.building_whse_id, v_header.building_src, v_header.building_key, v_header.building_code, v_header.building_name, v_header.building_status, v_header.feed_whse_id, v_header.feed_whse_code, v_header.feed_whse_name, v_header.animal_qty, v_user, v_user, '1')
    returning * into v_header;
  else
    update public.brd_fc set
      fc_no = v_header.fc_no,
      card_no = v_header.card_no,
      fc_date = v_header.fc_date,
      farm_id = v_header.farm_id,
      farm_code = v_header.farm_code,
      farm_name = v_header.farm_name,
      building_id = v_header.building_id,
      building_whse_id = v_header.building_whse_id,
      building_src = v_header.building_src,
      building_key = v_header.building_key,
      building_code = v_header.building_code,
      building_name = v_header.building_name,
      building_status = v_header.building_status,
      feed_whse_id = v_header.feed_whse_id,
      feed_whse_code = v_header.feed_whse_code,
      feed_whse_name = v_header.feed_whse_name,
      animal_qty = v_header.animal_qty,
      updated_by = v_user
    where id = v_id and void = '1' returning * into v_header;
    if not found then raise exception 'Growing header could not be updated.'; end if;
  end if;

  for v_input in select value from jsonb_array_elements(p_payload->'lines') order by (value->>'age')::integer
  loop
    begin
      select * into v_saved_line from public.brd_fc_line
      where fc_id = v_header.id and age = (v_input->>'age')::integer and void = '1'
      for update;
      if found then
        v_line := jsonb_populate_record(v_saved_line, v_input->'update');
        update public.brd_fc_line set
          mort_am = v_line.mort_am,
          mort_pm = v_line.mort_pm,
          mort_total = v_line.mort_total,
          thin_am = v_line.thin_am,
          thin_pm = v_line.thin_pm,
          row_total = v_line.row_total,
          cum_total = v_line.cum_total,
          feed_kg = v_line.feed_kg,
          feed_bird = v_line.feed_bird,
          feed_guideline = v_line.feed_guideline,
          feed_batch_text = v_line.feed_batch_text,
          water_l = v_line.water_l,
          water_bird = v_line.water_bird,
          body_wt = v_line.body_wt,
          body_guideline = v_line.body_guideline,
          temp_min = v_line.temp_min,
          temp_max = v_line.temp_max,
          hum_min = v_line.hum_min,
          hum_max = v_line.hum_max,
          nh3_max = v_line.nh3_max,
          skin_b = v_line.skin_b,
          skin_a = v_line.skin_a,
          skin_l = v_line.skin_l,
          extra = v_line.extra,
          is_locked = v_line.is_locked,
          updated_by = v_user
        where id = v_saved_line.id and void = '1' returning * into v_saved_line;
        if not found then raise exception 'Growing line could not be updated.'; end if;
      else
        v_line := jsonb_populate_record(null::public.brd_fc_line, v_input->'insert');
        insert into public.brd_fc_line (fc_id, age, mort_am, mort_pm, mort_total, thin_am, thin_pm, row_total, cum_total, feed_kg, feed_bird, feed_guideline, feed_batch_text, water_l, water_bird, body_wt, body_guideline, temp_min, temp_max, hum_min, hum_max, nh3_max, skin_b, skin_a, skin_l, extra, is_locked, created_by, updated_by, void)
        values (v_header.id, (v_input->>'age')::integer, v_line.mort_am, v_line.mort_pm, v_line.mort_total, v_line.thin_am, v_line.thin_pm, v_line.row_total, v_line.cum_total, v_line.feed_kg, v_line.feed_bird, v_line.feed_guideline, v_line.feed_batch_text, v_line.water_l, v_line.water_bird, v_line.body_wt, v_line.body_guideline, v_line.temp_min, v_line.temp_max, v_line.hum_min, v_line.hum_max, v_line.nh3_max, v_line.skin_b, v_line.skin_a, v_line.skin_l, v_line.extra, v_line.is_locked, v_user, v_user, '1')
        returning * into v_saved_line;
      end if;
      v_feed := nullif(v_input->'feed', 'null'::jsonb);
      if v_feed is not null then
        perform public.save_brd_fc_feed_intake(
          v_saved_line.id,
          (v_feed->>'p_feed_kg')::numeric,
          (v_feed->>'p_feed_bird')::numeric,
          (v_feed->>'p_feed_guideline')::numeric,
          v_feed->>'p_feed_batch_text',
          (v_feed->>'p_feed_type_id')::bigint,
          v_feed->'p_allocations'
        );
      end if;
      v_lines := v_lines || jsonb_build_array(jsonb_build_object('id', v_saved_line.id, 'age', v_saved_line.age));
    exception when others then
      -- Re-raise: the outer RPC transaction also rolls back all earlier ages.
      raise exception using message = format('Age %s: %s', v_input->>'age', sqlerrm), errcode = sqlstate;
    end;
  end loop;
  v_result := jsonb_build_object('id', v_header.id, 'fcNo', v_header.fc_no, 'savedLines', v_lines);
  insert into public.brd_fc_save_requests(request_id, actor_auth_id, payload_hash, fc_id, is_new, result)
  values (p_request_id, v_user, v_hash, v_header.id, v_id is null, v_result);
  return v_result;
end;
$$;
revoke all on function public.save_brd_fc_transaction(uuid, jsonb) from public;
grant execute on function public.save_brd_fc_transaction(uuid, jsonb) to authenticated;
-- The receipt is written once, after every mutation succeeds. This trigger
-- enqueues in that same transaction; it never resolves recipients itself.
create or replace function public.enqueue_brd_fc_save_event()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_card public.brd_fc%rowtype;
  v_event text := case when new.is_new then 'BRD_FC_POSTED' else 'BRD_FC_EDITED' end;
begin
  select card.* into v_card from public.brd_fc card
  join public.farms farm on farm.id = card.farm_id
  where card.id = new.fc_id and card.void = '1'
    and upper(btrim(farm.farm_type)) in ('BR', 'BROILER');
  if not found then raise exception 'Growing notification requires its persisted Broiler farm.'; end if;
  insert into public.notification_outbox (
    module_key, event_key, entity_type, entity_id, document_no,
    fms_type, farm_id, recipient_farm_id, actor_auth_id, target_url,
    permission_group, permission_title, title, message, priority,
    metadata, dedupe_key, occurred_at
  ) values (
    'BRD_FC', v_event, 'brd_fc', v_card.id::text, v_card.fc_no,
    'Broiler', v_card.farm_id, v_card.farm_id, new.actor_auth_id,
    '/brd/fc', 'Menus', 'Growing & Farm Condition/view', 'Growing saved',
    'Growing {document_no} was saved by {initiator_name}.', 'normal',
    '{}'::jsonb, v_event || ':' || new.request_id::text, new.created_at
  ) on conflict (dedupe_key) do nothing;
  return new;
end;
$$;
drop trigger if exists brd_fc_save_event on public.brd_fc_save_requests;
create trigger brd_fc_save_event after insert on public.brd_fc_save_requests
for each row execute function public.enqueue_brd_fc_save_event();
-- Reversal is an edit of an existing Growing record, not a document void.
create or replace function public.enqueue_brd_fc_reversal_event()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_card public.brd_fc%rowtype;
  v_changed text[] := array[]::text[];
begin
  if new.reversed_at is null then return new; end if;
  if old.feed_kg is not null and new.feed_kg is null then
    v_changed := array_append(v_changed, 'feedIntake');
  end if;
  if old.extra ? 'mortalityBatchAllocations' and not (new.extra ? 'mortalityBatchAllocations') then
    v_changed := array_append(v_changed, 'mortalityThinning');
  end if;
  if cardinality(v_changed) = 0 then return new; end if;
  select card.* into v_card from public.brd_fc card
  join public.farms farm on farm.id = card.farm_id
  where card.id = new.fc_id and upper(btrim(farm.farm_type)) in ('BR', 'BROILER');
  if not found then raise exception 'Growing reversal requires its persisted Broiler farm.'; end if;
  insert into public.notification_outbox (
    module_key, event_key, entity_type, entity_id, document_no,
    fms_type, farm_id, recipient_farm_id, actor_auth_id, target_url,
    permission_group, permission_title, title, message, priority,
    metadata, dedupe_key, occurred_at
  ) values (
    'BRD_FC', 'BRD_FC_EDITED', 'brd_fc', v_card.id::text, v_card.fc_no,
    'Broiler', v_card.farm_id, v_card.farm_id, coalesce(auth.uid(), new.reversed_by),
    '/brd/fc', 'Menus', 'Growing & Farm Condition/view', 'Growing edited',
    'Growing {document_no} was edited by {initiator_name}.', 'normal',
    jsonb_build_object('changedFields', to_jsonb(v_changed)),
    'BRD_FC_EDITED:REVERSAL:' || new.id::text || ':' || txid_current()::text, now()
  ) on conflict (dedupe_key) do nothing;
  return new;
end;
$$;
drop trigger if exists brd_fc_reversal_event on public.brd_fc_line;
create trigger brd_fc_reversal_event after update on public.brd_fc_line
for each row execute function public.enqueue_brd_fc_reversal_event();
notify pgrst, 'reload schema';
commit;
