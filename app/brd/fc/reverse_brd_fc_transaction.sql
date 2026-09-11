-- Apply after new/flock_card_tables.sql, new/save_brd_fc_transaction.sql,
-- and admin/notifications/notification_system.sql. No existing documents are reversed by deployment.
begin;

-- Scope mortality reversal deduplication to its source row, including equal quantities at different ages.
create or replace function public.reverse_brd_fc_mortality_thinning(
  p_line_id bigint,
  p_reason text default null
)
returns table (id bigint, age integer)
language plpgsql
as $$
declare
  v_line record;
  v_card record;
  v_posting record;
  v_user uuid;
  v_docentry_start bigint;
  v_docentry_end bigint;
begin
  v_user := auth.uid();

  select *
  into v_line
  from public.brd_fc_line line
  where line.id = p_line_id
    and line.void = '1'
  for update;

  if not found then
    raise exception 'Unable to reverse mortality/thinning: flock card line % was not found', p_line_id;
  end if;

  select *
  into v_card
  from public.brd_fc card
  where card.id = v_line.fc_id
    and card.void = '1';

  if not found then
    raise exception 'Unable to reverse mortality/thinning: flock card % was not found', v_line.fc_id;
  end if;

  v_user := coalesce(v_user, v_line.updated_by, v_line.created_by, v_card.updated_by, v_card.created_by);

  if v_user is null then
    raise exception 'Unable to reverse mortality/thinning: user is required';
  end if;

  v_docentry_start := p_line_id * 1000000;
  v_docentry_end := v_docentry_start + 999999;

  for v_posting in
    select
      row_number() over (order by ip.id)::integer as line_no,
      ip.*
    from public.inventory_postings ip
    where ip.source_doc_type in (
        'BRD_FC_MORT_THIN_USAGE',
        'BRD_FC_MORT_THIN_TRANSFER_OUT',
        'BRD_FC_MORT_THIN_TRANSFER_IN'
      )
      and (
        ip.source_docentry = p_line_id
        or ip.source_docentry between v_docentry_start and v_docentry_end
      )
      and not exists (
        select 1
        from public.inventory_postings reversal_posting
        where reversal_posting.source_doc_type = 'BRD_FC_MORT_THIN_REVERSAL'
          and (reversal_posting.source_docentry = p_line_id
            or reversal_posting.source_docentry between v_docentry_start and v_docentry_end)
          and reversal_posting.id > ip.id
          and reversal_posting.ref = ip.ref
          and reversal_posting.item_code = ip.item_code
          and reversal_posting.warehouse_code = ip.warehouse_code
          and reversal_posting.qty = ip.qty
      )
  loop
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
      'BRD_FC_MORT_THIN_REVERSAL',
      p_line_id * 1000000 + 700000 + v_posting.line_no,
      v_posting.item_code,
      v_posting.warehouse_code,
      coalesce(v_posting.bin_code, 'DEFAULT'),
      v_posting.qty,
      v_user,
      coalesce(v_posting.ref_type, 'batch_code'),
      v_posting.ref,
      case when v_posting.transfer_type = 'OUT' then 'IN' else 'OUT' end,
      'FLOCK_CARD',
      v_card.fc_no
    );
  end loop;

  return query
  update public.brd_fc_line line
  set
    mort_am = null,
    mort_pm = null,
    mort_total = null,
    thin_am = null,
    thin_pm = null,
    row_total = null,
    cum_total = null,
    extra = coalesce(line.extra, '{}'::jsonb) - 'mortalityBatchAllocations',
    updated_by = v_user,
    reversed_by = v_user,
    reversed_at = coalesce(line.reversed_at, now()),
    reversal_reason = coalesce(nullif(btrim(p_reason), ''), line.reversal_reason, 'Reverse mortality/thinning')
  where line.id = p_line_id
    and line.void = '1'
  returning line.id, line.age;
end;
$$;
create or replace function public.post_brd_fc_mortality_thinning_inventory()
returns trigger
language plpgsql
as $$
declare
  v_card record;
  v_fc_id bigint;
  v_source_whse_code text;
  v_dest_whse_code text;
  v_docentry_base bigint;
  v_docentry_start bigint;
  v_docentry_end bigint;
  v_docentry_generation integer;
  v_user uuid;
  v_allocation record;
  v_on_hand numeric(18, 6);
  v_line_changed boolean;
  v_has_usage boolean;
  v_has_legacy_usage boolean;
  v_should_reverse boolean;
begin
  if tg_op = 'INSERT' then
    if new.void <> '1' then
      return new;
    end if;

    v_line_changed := true;
    v_has_usage := false;
    v_has_legacy_usage := false;
    v_should_reverse := false;
  else
    v_docentry_start := old.id * 1000000;
    v_docentry_end := v_docentry_start + 999999;
    v_line_changed := old.extra is distinct from new.extra;
    select exists (
      select 1
      from public.inventory_postings ip
      where ip.source_doc_type in ('BRD_FC_MORT_THIN_USAGE', 'BRD_FC_MORT_THIN_TRANSFER_OUT')
        and ip.source_docentry between v_docentry_start and v_docentry_end
    )
    into v_has_usage;
    select exists (
      select 1
      from public.inventory_postings usage_posting
      where usage_posting.source_doc_type = 'BRD_FC_MORT_THIN_USAGE'
        and usage_posting.source_docentry = old.id
        and not exists (
          select 1
          from public.inventory_postings reversal_posting
          where reversal_posting.source_doc_type = 'BRD_FC_MORT_THIN_REVERSAL'
          and (reversal_posting.source_docentry = old.id
            or reversal_posting.source_docentry between v_docentry_start and v_docentry_end)
            and reversal_posting.id > usage_posting.id
            and reversal_posting.ref = usage_posting.ref
            and reversal_posting.item_code = usage_posting.item_code
            and reversal_posting.warehouse_code = usage_posting.warehouse_code
            and reversal_posting.qty = usage_posting.qty
        )
    )
    into v_has_legacy_usage;
    v_should_reverse := v_has_usage and (v_line_changed or (old.void = '1' and new.void = '0'));

    if old.void = '1' and new.void = '0' then
      v_line_changed := true;
    elsif v_has_legacy_usage then
      v_line_changed := true;
    elsif not v_line_changed
      and not v_has_usage
      and jsonb_array_length(
        case
          when jsonb_typeof(coalesce(new.extra->'mortalityBatchAllocations', '[]'::jsonb)) = 'array'
            then coalesce(new.extra->'mortalityBatchAllocations', '[]'::jsonb)
          else '[]'::jsonb
        end
      ) > 0 then
      v_line_changed := true;
    elsif not v_line_changed then
      return new;
    end if;
  end if;

  v_fc_id := case
    when tg_op = 'INSERT' then new.fc_id
    else coalesce(new.fc_id, old.fc_id)
  end;
  v_docentry_base := new.id * 1000000;

  select
    card.*,
    iw.whse_code as building_whse_code,
    disposal_whse.whse_code as disposal_whse_code
  into v_card
  from public.brd_fc card
  left join public.i_warehouse iw
    on iw.id = card.building_whse_id
  left join lateral (
    select disposal.whse_code
    from public.i_warehouse disposal
    where disposal.farm_id = card.farm_id
      and disposal.is_default_disposal_warehouse
    order by disposal.id
    limit 1
  ) disposal_whse on true
  where card.id = v_fc_id;

  if not found then
    raise exception 'Unable to post mortality/thinning inventory: flock card % was not found', v_fc_id;
  end if;

  v_user := case
    when tg_op = 'INSERT' then coalesce(new.updated_by, new.created_by, v_card.updated_by, v_card.created_by, auth.uid())
    else coalesce(new.updated_by, new.created_by, old.updated_by, old.created_by, v_card.updated_by, v_card.created_by, auth.uid())
  end;
  v_source_whse_code := nullif(btrim(coalesce(v_card.building_code, v_card.building_whse_code, '')), '');
  v_dest_whse_code := nullif(btrim(coalesce(v_card.disposal_whse_code, '')), '');

  if v_user is null then
    raise exception 'Unable to post mortality/thinning inventory: user is required';
  end if;

  if tg_op = 'UPDATE' and v_has_legacy_usage then
    for v_allocation in
      select
        row_number() over (order by ip.id)::integer as line_no,
        ip.item_code,
        ip.ref as batch_no,
        ip.warehouse_code as whse_code,
        ip.qty as alloc_qty
      from public.inventory_postings ip
      where ip.source_doc_type = 'BRD_FC_MORT_THIN_USAGE'
        and ip.source_docentry = old.id
        and not exists (
          select 1
          from public.inventory_postings reversal_posting
          where reversal_posting.source_doc_type = 'BRD_FC_MORT_THIN_REVERSAL'
          and (reversal_posting.source_docentry = old.id
            or reversal_posting.source_docentry between v_docentry_start and v_docentry_end)
            and reversal_posting.id > ip.id
            and reversal_posting.ref = ip.ref
            and reversal_posting.item_code = ip.item_code
            and reversal_posting.warehouse_code = ip.warehouse_code
            and reversal_posting.qty = ip.qty
        )
    loop
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
        'BRD_FC_MORT_THIN_REVERSAL',
        old.id * 1000000 + 900000 + v_allocation.line_no,
        v_allocation.item_code,
        v_allocation.whse_code,
        'DEFAULT',
        v_allocation.alloc_qty,
        v_user,
        'batch_code',
        v_allocation.batch_no,
        'IN',
        'FLOCK_CARD',
        v_card.fc_no
      );
    end loop;
  end if;

  if tg_op = 'UPDATE' and v_should_reverse then
    for v_allocation in
      select
        row_number() over (order by ip.id)::integer as line_no,
        ip.item_code,
        ip.ref as batch_no,
        ip.warehouse_code as whse_code,
        ip.qty as alloc_qty,
        ip.transfer_type
      from public.inventory_postings ip
      where ip.source_doc_type in (
        'BRD_FC_MORT_THIN_USAGE',
        'BRD_FC_MORT_THIN_TRANSFER_OUT',
        'BRD_FC_MORT_THIN_TRANSFER_IN'
      )
        and ip.source_docentry between v_docentry_start and v_docentry_end
        and not exists (
          select 1
          from public.inventory_postings reversal_posting
          where reversal_posting.source_doc_type = 'BRD_FC_MORT_THIN_REVERSAL'
          and (reversal_posting.source_docentry = old.id
            or reversal_posting.source_docentry between v_docentry_start and v_docentry_end)
            and reversal_posting.id > ip.id
            and reversal_posting.ref = ip.ref
            and reversal_posting.item_code = ip.item_code
            and reversal_posting.warehouse_code = ip.warehouse_code
            and reversal_posting.qty = ip.qty
        )
    loop
      if v_allocation.item_code is null
        or v_allocation.whse_code is null
        or v_allocation.batch_no is null
        or coalesce(v_allocation.alloc_qty, 0) <= 0 then
        continue;
      end if;

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
        'BRD_FC_MORT_THIN_REVERSAL',
        old.id * 1000000 + 800000 + v_allocation.line_no,
        v_allocation.item_code,
        v_allocation.whse_code,
        'DEFAULT',
        v_allocation.alloc_qty,
        v_user,
        'batch_code',
        v_allocation.batch_no,
        case when v_allocation.transfer_type = 'OUT' then 'IN' else 'OUT' end,
        'FLOCK_CARD',
        v_card.fc_no
      );
    end loop;
  end if;

  if new.void <> '1' then
    return new;
  end if;

  if jsonb_array_length(
    case
      when jsonb_typeof(coalesce(new.extra->'mortalityBatchAllocations', '[]'::jsonb)) = 'array'
        then coalesce(new.extra->'mortalityBatchAllocations', '[]'::jsonb)
      else '[]'::jsonb
    end
  ) = 0 then
    return new;
  end if;

  if v_dest_whse_code is null then
    raise exception 'Unable to post mortality/thinning transfer: farm % has no default Disposal warehouse', v_card.farm_id;
  end if;

  if v_source_whse_code is null then
    raise exception 'Unable to post mortality/thinning transfer: flock/building warehouse is required';
  end if;

  if v_source_whse_code = v_dest_whse_code then
    raise exception 'Unable to post mortality/thinning transfer: source and Disposal warehouses must be different';
  end if;

  select coalesce(max(((ip.source_docentry - v_docentry_base) / 1000)::integer), -1) + 1
  into v_docentry_generation
  from public.inventory_postings ip
  where ip.source_doc_type = 'BRD_FC_MORT_THIN_TRANSFER_OUT'
    and ip.source_docentry between v_docentry_base and v_docentry_base + 999999;

  for v_allocation in
    select
      allocation.ordinality::integer as line_no,
      nullif(allocation.value->>'itemCode', '') as item_code,
      nullif(allocation.value->>'batchNumber', '') as batch_no,
      nullif(allocation.value->>'warehouseCode', '') as whse_code,
      coalesce(nullif(allocation.value->>'allocatedQty', '')::numeric, 0) as alloc_qty
    from jsonb_array_elements(
      case
        when jsonb_typeof(coalesce(new.extra->'mortalityBatchAllocations', '[]'::jsonb)) = 'array'
          then coalesce(new.extra->'mortalityBatchAllocations', '[]'::jsonb)
        else '[]'::jsonb
      end
    ) with ordinality as allocation(value, ordinality)
  loop
    v_allocation.whse_code := coalesce(v_source_whse_code, v_allocation.whse_code);

    if v_allocation.item_code is null then
      raise exception 'Unable to post mortality/thinning inventory: item_code is required';
    end if;

    if v_allocation.whse_code is null then
      raise exception 'Unable to post mortality/thinning inventory: warehouse is required';
    end if;

    if v_allocation.batch_no is null then
      raise exception 'Unable to post mortality/thinning inventory: batch_no is required';
    end if;

    if coalesce(v_allocation.alloc_qty, 0) <= 0 then
      raise exception 'Unable to post mortality/thinning inventory: allocation quantity must be greater than zero';
    end if;

    select coalesce(sum(case when ip.transfer_type = 'OUT' then -ip.qty else ip.qty end), 0)
    into v_on_hand
    from public.inventory_postings ip
    where ip.item_code = v_allocation.item_code
      and ip.warehouse_code = v_allocation.whse_code
      and ip.ref is not distinct from v_allocation.batch_no;

    if v_allocation.alloc_qty > v_on_hand then
      raise exception 'Flock card mortality/thinning exceeds on-hand inventory for item %, batch %, warehouse %.',
        v_allocation.item_code, v_allocation.batch_no, v_allocation.whse_code;
    end if;

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
      'BRD_FC_MORT_THIN_TRANSFER_OUT',
      v_docentry_base + (v_docentry_generation * 1000) + v_allocation.line_no,
      v_allocation.item_code,
      v_allocation.whse_code,
      'DEFAULT',
      v_allocation.alloc_qty,
      v_user,
      'batch_code',
      v_allocation.batch_no,
      'OUT',
      'FLOCK_CARD',
      v_card.fc_no
    );

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
      'BRD_FC_MORT_THIN_TRANSFER_IN',
      v_docentry_base + (v_docentry_generation * 1000) + v_allocation.line_no,
      v_allocation.item_code,
      v_dest_whse_code,
      'DEFAULT',
      v_allocation.alloc_qty,
      v_user,
      'batch_code',
      v_allocation.batch_no,
      'IN',
      'FLOCK_CARD',
      v_card.fc_no
    );
  end loop;

  return new;
end;
$$;

create table if not exists public.brd_fc_reversal_requests (
  growing_id bigint primary key references public.brd_fc(id),
  flock_card_id bigint not null references public.flock_card(id),
  farm_id bigint not null references public.farms(id),
  actor_auth_id uuid not null references auth.users(id),
  reason text not null check (length(btrim(reason)) between 1 and 1000),
  transaction_id bigint not null,
  created_at timestamptz not null default now(),
  header_snapshot jsonb not null,
  line_snapshot jsonb not null,
  allocation_snapshot jsonb not null,
  result jsonb not null
);
alter table public.brd_fc_reversal_requests enable row level security;
revoke all on public.brd_fc_reversal_requests from public, anon, authenticated;

-- Protected transaction receipt suppresses row-level edit events only inside
-- a full reversal. Unlike a client-settable GUC, clients cannot forge it.
create or replace function public.brd_fc_is_full_reversal(p_growing_id bigint)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.brd_fc_reversal_requests r,
      jsonb_array_elements(r.header_snapshot) h
    where r.transaction_id = txid_current() and (h->>'id')::bigint = p_growing_id
  );
$$;
revoke all on function public.brd_fc_is_full_reversal(bigint) from public, anon, authenticated;

-- Preserve the existing single-row reversal event contract.
create or replace function public.enqueue_brd_fc_reversal_event()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_card public.brd_fc%rowtype;
  v_changed text[] := array[]::text[];
begin
  if new.reversed_at is null or public.brd_fc_is_full_reversal(new.fc_id) then return new; end if;
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

create or replace function public.reverse_brd_fc_transaction(p_growing_id bigint, p_reason text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_growing public.brd_fc%rowtype;
  v_placement public.flock_card%rowtype;
  v_ids bigint[];
  v_line record;
  v_result jsonb;
  v_batch text;
begin
  if v_actor is null or not exists (
    select 1 from public.users u where u.auth_id = v_actor and u.user_type = 1
  ) then raise exception 'Only Super Admin can reverse Growing.' using errcode = '42501'; end if;
  if p_reason is null or length(btrim(p_reason)) not between 1 and 1000 then
    raise exception 'A reversal reason of 1 to 1000 characters is required.';
  end if;
  select * into v_growing from public.brd_fc where id = p_growing_id;
  if not found then raise exception 'Growing record was not found.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('BRD_FC_FARM:' || v_growing.farm_id::text, 0));
  select result into v_result from public.brd_fc_reversal_requests where growing_id = p_growing_id;
  if found then return v_result; end if;

  -- Rare administrative operation: block concurrent writes, including legacy
  -- non-RPC Harvest/Clean Up writers, while checking eligibility and reversing.
  -- Reads remain available. All locks release on commit or rollback.
  lock table public.br_delivery, public.br_delivery_lines,
    public.br_cleanup, public.br_cleanup_lines,
    public.flock_card, public.flock_card_origin,
    public.brd_fc, public.brd_fc_line, public.brd_fc_ba in share row exclusive mode;
  select * into v_growing from public.brd_fc where id = p_growing_id and void = '1';
  if not found then raise exception 'Growing was already reversed. Refresh the building list.'; end if;
  select c.* into v_placement from public.flock_card c
  join public.farms f on f.id = c.farm_id and upper(btrim(f.farm_type)) in ('BR', 'BROILER')
  where c.card_no = v_growing.card_no and c.farm_id = v_growing.farm_id
    and c.void = '1' and c.status = 'Saved' and nullif(btrim(c.cycle_no), '') is not null;
  if not found then raise exception 'Growing requires an active building cycle and a valid Broiler farm.'; end if;
  if v_growing.building_whse_id is distinct from v_placement.building_whse_id
    or v_growing.building_id is distinct from v_placement.building_id then
    raise exception 'Growing does not match the cycle building.';
  end if;
  v_batch := upper(format('DOC:F%s:B%s:%s', v_placement.farm_id, v_placement.building_whse_id, btrim(v_placement.cycle_no)));

  -- Same warehouse + exact consolidated cycle batch or placement item/batch.
  -- Drafts without a chosen batch conservatively block the active building.
  if exists (
    select 1 from (
      select h.farm_id, h.status, h.from_warehouse_id as header_whse_id,
        h.from_warehouse_code as header_whse_code, l.from_warehouse_id,
        l.from_warehouse_code, l.item_code, l.batch_number
      from public.br_delivery h left join public.br_delivery_lines l
        on l.br_delivery_id = h.id and l.void = '1' where h.status <> 'Cancelled'
      union all
      select h.farm_id, h.status, h.from_warehouse_id, h.from_warehouse_code,
        l.from_warehouse_id, l.from_warehouse_code, l.item_code, l.batch_number
      from public.br_cleanup h left join public.br_cleanup_lines l
        on l.br_cleanup_id = h.id and l.void = '1' where h.status <> 'Cancelled'
    ) movement
    where movement.farm_id = v_placement.farm_id
      and case when coalesce(movement.from_warehouse_id, movement.header_whse_id) is not null
                     and v_placement.building_whse_id is not null
        then coalesce(movement.from_warehouse_id, movement.header_whse_id) = v_placement.building_whse_id
        else nullif(upper(btrim(coalesce(movement.from_warehouse_code, movement.header_whse_code))), '')
          = nullif(upper(btrim(v_placement.building_code)), '') end
      and (
        upper(btrim(movement.batch_number)) = v_batch
        or (movement.status = 'Draft' and nullif(btrim(movement.batch_number), '') is null)
        or exists (select 1 from public.flock_card_origin origin
          where origin.fc_id = v_placement.id and origin.void = '1'
            and upper(btrim(origin.item_code)) = upper(btrim(movement.item_code))
            and upper(btrim(origin.batch_no)) = upper(btrim(movement.batch_number)))
      )
  ) then raise exception 'Reverse Growing is blocked by an active Harvest or Clean Up record for this building and cycle.'; end if;

  select array_agg(id order by id) into v_ids from public.brd_fc
  where card_no = v_placement.card_no and void = '1';
  if exists (select 1 from public.brd_fc where id = any(v_ids) and farm_id is distinct from v_placement.farm_id) then
    raise exception 'Growing farm identity does not match its cycle.';
  end if;
  -- Thinning is deliberately outside this action. Never silently reverse legacy thinning.
  if exists (select 1 from public.brd_fc_line where fc_id = any(v_ids) and void = '1'
    and (coalesce(thin_am, 0) <> 0 or coalesce(thin_pm, 0) <> 0)) then
    raise exception 'This Growing record contains thinning. Full reversal does not support thinning.';
  end if;
  v_result := jsonb_build_object('growingId', p_growing_id, 'flockCardId', v_placement.id, 'reversed', true);
  insert into public.brd_fc_reversal_requests (
    growing_id, flock_card_id, farm_id, actor_auth_id, reason, transaction_id,
    header_snapshot, line_snapshot, allocation_snapshot, result
  ) values (
    p_growing_id, v_placement.id, v_placement.farm_id, v_actor, btrim(p_reason), txid_current(),
    (select jsonb_agg(to_jsonb(h)) from public.brd_fc h where id = any(v_ids)),
    coalesce((select jsonb_agg(to_jsonb(l)) from public.brd_fc_line l where fc_id = any(v_ids) and void = '1'), '[]'),
    coalesce((select jsonb_agg(to_jsonb(a)) from public.brd_fc_ba a join public.brd_fc_line l on l.id = a.fc_line_id
      where l.fc_id = any(v_ids) and a.void = '1'), '[]'), v_result
  );
  for v_line in select id, fc_id, age from public.brd_fc_line
    where fc_id = any(v_ids) and void = '1' order by age desc, id desc
  loop
    perform public.reverse_brd_fc_feed_intake(v_line.id, p_reason);
    perform public.reverse_brd_fc_mortality_thinning(v_line.id, p_reason);
    update public.brd_fc_line set void = '0', updated_by = v_actor,
      reversed_at = now(), reversed_by = v_actor, reversal_reason = btrim(p_reason)
    where id = v_line.id;
  end loop;
  update public.brd_fc set void = '0', status = 'Cancelled', actual_age = null,
    updated_by = v_actor, updated_at = now() where id = any(v_ids);

  insert into public.notification_outbox (
    module_key, event_key, entity_type, entity_id, document_no, fms_type,
    farm_id, recipient_farm_id, actor_auth_id, target_url, permission_group,
    permission_title, title, message, priority, metadata, dedupe_key, occurred_at
  ) values (
    'BRD_FC', 'BRD_FC_VOIDED', 'brd_fc', p_growing_id::text, v_growing.fc_no, 'Broiler',
    v_growing.farm_id, v_growing.farm_id, v_actor, '/brd/fc', 'Menus',
    'Growing & Farm Condition/view', 'Growing reversed',
    'Growing {document_no} was reversed by {initiator_name}.', 'normal',
    jsonb_build_object('changedFields', array['mortality', 'feedIntake', 'growing'], 'flockCardId', v_placement.id),
    'BRD_FC_VOIDED:' || p_growing_id::text, now()
  ) on conflict (dedupe_key) do nothing;
  return v_result;
end;
$$;
revoke all on function public.reverse_brd_fc_transaction(bigint, text) from public, anon;
grant execute on function public.reverse_brd_fc_transaction(bigint, text) to authenticated;
-- Keep canonical persisted-source validation for the new Void event.
create or replace function public.process_notification_outbox(p_limit integer default 50)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.notification_outbox%rowtype;
  v_processed integer := 0;
  v_next_attempt timestamp with time zone;
  v_source_valid boolean;
begin
  for v_event in
    select event_row.*
    from public.notification_outbox event_row
    where event_row.status in ('pending', 'failed')
      and event_row.next_attempt_at <= now()
    order by event_row.occurred_at, event_row.id
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 50), 200))
  loop
    begin
      update public.notification_outbox
      set status = 'processing',
          processing_started_at = now(),
          last_error = null
      where id = v_event.id;

      -- Each module integration must provide an authoritative verifier. The
      -- first integration accepts only the same DOC Placement posting version
      -- that was atomically stamped by the source-table trigger.
      if v_event.module_key = 'USER_REGISTRATION' then
        select exists (
          select 1 from public.users registered
          where registered.id::text = v_event.entity_id
            and registered.auth_id = v_event.actor_auth_id
            and registered.registration_completed_at = v_event.occurred_at
            and v_event.event_key = 'USER_REGISTRATION_POSTED'
            and v_event.entity_type = 'users'
            and v_event.dedupe_key = 'USER_REGISTRATION_POSTED:' || registered.auth_id::text
            and v_event.farm_id is null and v_event.recipient_farm_id is null
        ) into v_source_valid;
        if not coalesce(v_source_valid, false) then
          update public.notification_outbox
          set status = 'invalid', processed_at = now(), processing_started_at = null,
              last_error = 'Registration event does not match a persisted registration completion.'
          where id = v_event.id;
          continue;
        end if;
      elsif v_event.module_key = 'DOC_RECEIVING' and v_event.event_key = 'DOC_RECEIVING_POSTED' then
        if v_event.entity_id !~ '^[0-9]+$' then
          update public.notification_outbox
          set status = 'invalid',
              processed_at = now(),
              processing_started_at = null,
              last_error = 'DOC Placement source ID is invalid.'
          where id = v_event.id;
          continue;
        end if;

        if v_event.recipient_farm_id is null then
          update public.notification_outbox
          set status = 'invalid',
              processed_at = now(),
              processing_started_at = null,
              last_error = 'DOC Placement document farm is missing.'
          where id = v_event.id;
          continue;
        end if;

        select exists (
          select 1
          from public.goods_receipt receipt
          join public.farms farm on farm.id = receipt.farm_id
          where receipt.id = v_event.entity_id::bigint
            and lower(btrim(coalesce(receipt.status, ''))) in ('posted', 'received')
            and receipt.posting_version = v_event.posting_version
            and receipt.farm_id = v_event.farm_id
            and receipt.farm_id = v_event.recipient_farm_id
        ) into v_source_valid;

        if not coalesce(v_source_valid, false) then
          update public.notification_outbox
          set status = 'invalid',
              processed_at = now(),
              processing_started_at = null,
              last_error = 'DOC Placement is not posted at the recorded posting version.'
          where id = v_event.id;
          continue;
        end if;
      elsif v_event.module_key = 'HATCHERY_DOC_DISPATCH'
            and v_event.event_key = 'HATCHERY_DOC_DISPATCH_POSTED' then
        if v_event.entity_id !~ '^[0-9]+$' then
          update public.notification_outbox
          set status = 'invalid', processed_at = now(), processing_started_at = null,
              last_error = 'Hatchery DOC Dispatch source ID is invalid.'
          where id = v_event.id;
          continue;
        end if;

        if v_event.recipient_farm_id is null then
          update public.notification_outbox
          set status = 'invalid', processed_at = now(), processing_started_at = null,
              last_error = 'Hatchery DOC Dispatch destination farm is missing.'
          where id = v_event.id;
          continue;
        end if;

        select exists (
          select 1
          from public.dispatch_doc dispatch
          where dispatch.id = v_event.entity_id::bigint
            and dispatch.status = 'Posted'
            and dispatch.is_active
            and dispatch.posting_version = v_event.posting_version
            and dispatch.destination_farm_id = v_event.farm_id
            and dispatch.destination_farm_id = v_event.recipient_farm_id
        ) into v_source_valid;

        if not coalesce(v_source_valid, false) then
          update public.notification_outbox
          set status = 'invalid', processed_at = now(), processing_started_at = null,
              last_error = 'Hatchery DOC Dispatch is not posted at the recorded posting version.'
          where id = v_event.id;
          continue;
        end if;
      elsif v_event.module_key = 'BR_DELIVERY'
            and v_event.event_key in ('BR_DELIVERY_POSTED', 'BR_DELIVERY_EDITED') then
        select exists (
          select 1 from public.br_delivery delivery
          join public.farms farm on farm.id = delivery.farm_id
          where delivery.id::text = v_event.entity_id
            and delivery.farm_id = v_event.farm_id
            and delivery.farm_id = v_event.recipient_farm_id
            and v_event.entity_type = 'br_delivery'
            and v_event.fms_type = 'Broiler'
            and upper(btrim(farm.farm_type)) in ('BR', 'BROILER')
            and (v_event.event_key <> 'BR_DELIVERY_POSTED' or delivery.status = 'Posted')
        ) into v_source_valid;
        if not coalesce(v_source_valid, false) then
          update public.notification_outbox
          set status = 'invalid', processed_at = now(), processing_started_at = null,
              last_error = 'Harvest & Delivery event does not match its persisted farm.'
          where id = v_event.id;
          continue;
        end if;
      elsif v_event.module_key = 'BRD_FC'
            and v_event.event_key in ('BRD_FC_POSTED', 'BRD_FC_EDITED', 'BRD_FC_VOIDED') then
        select exists (
          select 1 from public.brd_fc card
          join public.farms farm on farm.id = card.farm_id
          where card.id::text = v_event.entity_id
            and card.farm_id = v_event.farm_id
            and card.farm_id = v_event.recipient_farm_id
            and v_event.entity_type = 'brd_fc'
            and v_event.fms_type = 'Broiler'
            and upper(btrim(farm.farm_type)) in ('BR', 'BROILER')
        ) into v_source_valid;
        if not coalesce(v_source_valid, false) then
          update public.notification_outbox
          set status = 'invalid', processed_at = now(), processing_started_at = null,
              last_error = 'Growing event does not match its persisted farm.'
          where id = v_event.id;
          continue;
        end if;
      elsif v_event.module_key = 'FARM'
            and v_event.event_key in ('FARM_POSTED', 'FARM_EDITED', 'FARM_VOIDED') then
        if v_event.entity_id !~ '^[0-9]+$' then
          update public.notification_outbox
          set status = 'invalid', processed_at = now(), processing_started_at = null,
              last_error = 'Farm source ID is invalid.'
          where id = v_event.id;
          continue;
        end if;

        if v_event.farm_id is null
           or v_event.recipient_farm_id is null
           or v_event.farm_id <> v_event.recipient_farm_id then
          update public.notification_outbox
          set status = 'invalid', processed_at = now(), processing_started_at = null,
              last_error = 'Farm event routing identity is missing or inconsistent.'
          where id = v_event.id;
          continue;
        end if;

        select exists (
          select 1
          from public.farms farm
          where farm.id = v_event.entity_id::bigint
            and farm.id = v_event.farm_id
            and case upper(btrim(coalesce(farm.farm_type, '')))
              when 'BR' then 'Broiler'
              when 'BROILER' then 'Broiler'
              when 'BE' then 'Breeder'
              when 'BREEDER' then 'Breeder'
              when 'HA' then 'Hatchery'
              when 'HATCHERY' then 'Hatchery'
              else null
            end is not distinct from v_event.fms_type
            and (
              v_event.event_key in ('FARM_POSTED', 'FARM_EDITED')
              or (v_event.event_key = 'FARM_VOIDED'
                and coalesce(btrim(farm.void::text), '0') <> '1')
            )
        ) into v_source_valid;

        if not coalesce(v_source_valid, false) then
          update public.notification_outbox
          set status = 'invalid', processed_at = now(), processing_started_at = null,
              last_error = 'Farm source does not match the recorded event and routing identity.'
          where id = v_event.id;
          continue;
        end if;
      elsif v_event.module_key = 'VACCINATION_MEDS'
            and v_event.event_key in ('VACCINATION_MEDS_POSTED', 'VACCINATION_MEDS_EDITED', 'VACCINATION_MEDS_VOIDED') then
        if v_event.entity_id !~ '^[0-9]+$' then
          update public.notification_outbox
          set status = 'invalid', processed_at = now(), processing_started_at = null,
              last_error = 'Vaccination and Meds source ID is invalid.'
          where id = v_event.id;
          continue;
        end if;

        if v_event.farm_id is null or v_event.recipient_farm_id is null then
          update public.notification_outbox
          set status = 'invalid', processed_at = now(), processing_started_at = null,
              last_error = 'Vaccination and Meds document farm is missing.'
          where id = v_event.id;
          continue;
        end if;

        select exists (
          select 1
          from public.vnm_documents document
          join public.farms farm on farm.id = document.farm_id
          where document.id = v_event.entity_id::bigint
            and document.farm_id = v_event.farm_id
            and document.farm_id = v_event.recipient_farm_id
            and document.fms_type = v_event.fms_type
            and (
              (v_event.event_key = 'VACCINATION_MEDS_EDITED'
                and coalesce((v_event.metadata ->> 'editVersion')::integer, -1) between 1 and document.edit_version)
              or (v_event.event_key = 'VACCINATION_MEDS_POSTED'
                and document.status in ('Posted', 'Void')
                and document.posted_at is not null
                and document.posting_version = v_event.posting_version)
              or (v_event.event_key = 'VACCINATION_MEDS_VOIDED'
                and document.status = 'Void'
                and document.voided_at is not null
                and document.posting_version = v_event.posting_version)
            )
        ) into v_source_valid;

        if not coalesce(v_source_valid, false) then
          update public.notification_outbox
          set status = 'invalid', processed_at = now(), processing_started_at = null,
              last_error = 'Vaccination and Meds source does not match the recorded event version and farm.'
          where id = v_event.id;
          continue;
        end if;
      end if;

      with initiator_profile as (
        select concat_ws(' ', nullif(btrim(firstname), ''), nullif(btrim(lastname), '')) as initiator_name
        from public.users
        where auth_id = v_event.actor_auth_id
        limit 1
      ),
      ranked_recipients as (
        select distinct on (recipient.auth_id)
          rule.id as rule_id,
          recipient.id as recipient_user_id,
          recipient.auth_id as recipient_auth_id,
          rule.priority,
          replace(replace(
            replace(
              coalesce(nullif(btrim(rule.title_template), ''), v_event.title),
              '{document_no}', coalesce(v_event.document_no, '')
            ),
            '{initiator_name}', coalesce(nullif((select initiator_name from initiator_profile), ''), 'a user')
          ),
            '{actor_name}', coalesce(nullif((select initiator_name from initiator_profile), ''), 'a user')
          ) as rendered_title,
          replace(replace(
            replace(
              coalesce(nullif(btrim(rule.message_template), ''), v_event.message),
              '{document_no}', coalesce(v_event.document_no, '')
            ),
            '{initiator_name}', coalesce(nullif((select initiator_name from initiator_profile), ''), 'a user')
          ),
            '{actor_name}', coalesce(nullif((select initiator_name from initiator_profile), ''), 'a user')
          ) as rendered_message
        from public.notification_rules rule
        join public.users recipient on recipient.auth_id is not null
        where rule.void = '1'
          and rule.is_active
          and rule.module_key = v_event.module_key
          and rule.event_key = v_event.event_key
          and (
            cardinality(rule.source_fms_types) = 0
            or v_event.fms_type = any(rule.source_fms_types)
          )
          and (
            coalesce(recipient.user_type, 3) = 1
            or cardinality(rule.recipient_fms_types) = 0
            or recipient.fms_type = any(rule.recipient_fms_types)
          )
          and (
            cardinality(rule.user_types) = 0
            or coalesce(recipient.user_type, 3)::smallint = any(rule.user_types)
          )
          and (
            cardinality(rule.user_group_ids) = 0
            or recipient.users_group_id = any(rule.user_group_ids)
          )
          and btrim(coalesce(recipient.isactive::text, '0')) = '1'
          and (
            coalesce(recipient.user_type, 3) = 1
            or v_event.recipient_farm_id is null
            or exists (
              select 1
              from public.users_farms recipient_farm
              left join public.farms farm on farm.code = recipient_farm.farm_code
              where recipient_farm.users_id = recipient.id
                and btrim(coalesce(recipient_farm.void::text, '0')) = '1'
                and coalesce(recipient_farm.farm_id, farm.id) = v_event.recipient_farm_id
            )
          )
          and (
            not rule.exclude_actor
            or recipient.auth_id is distinct from v_event.actor_auth_id
          )
          and (
            not rule.require_view_permission
            or coalesce(recipient.user_type, 3) = 1
            or exists (
              select 1
              from public.user_permissions permission
              where permission.user_id = recipient.auth_id
                and permission.group_name = v_event.permission_group
                and permission.title = v_event.permission_title
                and permission.is_visible
            )
          )
        order by
          recipient.auth_id,
          case rule.priority
            when 'critical' then 1
            when 'high' then 2
            when 'normal' then 3
            else 4
          end,
          rule.id
      )
      insert into public.user_notifications (
        event_id,
        rule_id,
        recipient_user_id,
        recipient_auth_id,
        module_key,
        event_key,
        title,
        message,
        priority,
        target_url,
        occurred_at
      )
      select
        v_event.id,
        recipient.rule_id,
        recipient.recipient_user_id,
        recipient.recipient_auth_id,
        v_event.module_key,
        v_event.event_key,
        recipient.rendered_title,
        recipient.rendered_message,
        recipient.priority,
        v_event.target_url,
        v_event.occurred_at
      from ranked_recipients recipient
      on conflict (event_id, recipient_auth_id) do nothing;

      insert into public.notification_email_deliveries (
        event_id,
        rule_id,
        user_notification_id,
        recipient_user_id,
        recipient_auth_id,
        recipient_email,
        recipient_name,
        recipient_fms_type,
        initiator_name,
        module_key,
        event_key,
        document_no,
        title,
        message,
        priority,
        metadata,
        occurred_at,
        status,
        last_error
      )
      select
        inbox.event_id,
        inbox.rule_id,
        inbox.id,
        inbox.recipient_user_id,
        inbox.recipient_auth_id,
        nullif(btrim(recipient.email), ''),
        coalesce(
          nullif(concat_ws(' ', nullif(btrim(recipient.firstname), ''), nullif(btrim(recipient.lastname), '')), ''),
          nullif(btrim(recipient.email), ''),
          'FMS user'
        ),
        case
          when recipient.fms_type in ('Broiler', 'Breeder', 'Hatchery') then recipient.fms_type
          when cardinality(rule.recipient_fms_types) = 1 then rule.recipient_fms_types[1]
          else v_event.fms_type
        end,
        coalesce(
          nullif((
            select concat_ws(' ', nullif(btrim(initiator.firstname), ''), nullif(btrim(initiator.lastname), ''))
            from public.users initiator
            where initiator.auth_id = v_event.actor_auth_id
            limit 1
          ), ''),
          'a user'
        ),
        inbox.module_key,
        inbox.event_key,
        v_event.document_no,
        inbox.title,
        inbox.message,
        inbox.priority,
        v_event.metadata,
        inbox.occurred_at,
        case
          when btrim(coalesce(recipient.email, '')) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then 'pending'
          else 'skipped'
        end,
        case
          when btrim(coalesce(recipient.email, '')) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then null
          else 'Recipient user profile has no valid email address.'
        end
      from public.user_notifications inbox
      join public.notification_rules rule on rule.id = inbox.rule_id and rule.email_enabled
      join public.users recipient on recipient.id = inbox.recipient_user_id
      where inbox.event_id = v_event.id
      on conflict (event_id, recipient_auth_id) do nothing;

      update public.notification_outbox
      set status = 'processed',
          processed_at = now(),
          processing_started_at = null,
          last_error = null
      where id = v_event.id;

      v_processed := v_processed + 1;
    exception when others then
      v_next_attempt := now() + case
        when v_event.attempt_count <= 0 then interval '1 minute'
        when v_event.attempt_count = 1 then interval '5 minutes'
        when v_event.attempt_count = 2 then interval '15 minutes'
        else interval '1 hour'
      end;

      update public.notification_outbox
      set status = 'failed',
          attempt_count = attempt_count + 1,
          last_error = sqlerrm,
          next_attempt_at = v_next_attempt,
          processing_started_at = null
      where id = v_event.id;
    end;
  end loop;

  return v_processed;
end;
$$;
notify pgrst, 'reload schema';
commit;
