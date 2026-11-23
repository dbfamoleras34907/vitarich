create table if not exists public.feed_farm_transfers (
  id bigint generated always as identity primary key,
  transfer_no text not null unique,
  transfer_date date not null,
  fms_type text not null default 'Broiler' check (fms_type = 'Broiler'),
  source_farm_id bigint not null references public.farms(id),
  source_farm_code text not null,
  source_farm_name text not null,
  destination_farm_id bigint not null references public.farms(id),
  destination_farm_code text not null,
  destination_farm_name text not null,
  source_warehouse_id bigint not null references public.i_warehouse(id),
  source_warehouse_code text not null,
  source_warehouse_name text not null,
  destination_warehouse_id bigint not null references public.i_warehouse(id),
  destination_warehouse_code text not null,
  destination_warehouse_name text not null,
  status text not null default 'Draft' check (status in ('Draft', 'Pending Approval', 'Approved')),
  remarks text null,
  requested_by uuid null references auth.users(id),
  requested_at timestamptz null,
  approved_by uuid null references auth.users(id),
  approved_at timestamptz null,
  posting_version integer not null default 0 check (posting_version >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  updated_at timestamptz null,
  constraint feed_farm_transfers_distinct_farms_check check (source_farm_id <> destination_farm_id)
);

create table if not exists public.feed_farm_transfer_items (
  id bigint generated always as identity primary key,
  feed_farm_transfer_id bigint not null references public.feed_farm_transfers(id) on delete cascade,
  line_no integer not null,
  item_id bigint not null references public.items(id),
  item_code text not null,
  description text null,
  source_batch_number text not null,
  destination_batch_number text null,
  manufacturing_date date not null,
  expiry_date date not null,
  base_qty numeric(18,6) not null check (base_qty > 0),
  base_uom text not null,
  source_unit_cost numeric(18,6) null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  updated_at timestamptz null,
  constraint feed_farm_transfer_items_line_key unique (feed_farm_transfer_id, line_no)
);

create index if not exists feed_farm_transfers_status_created_idx
  on public.feed_farm_transfers(status, created_at desc);
create index if not exists feed_farm_transfers_source_farm_idx
  on public.feed_farm_transfers(source_farm_id);
create index if not exists feed_farm_transfers_destination_farm_idx
  on public.feed_farm_transfers(destination_farm_id);
create index if not exists feed_farm_transfer_items_header_idx
  on public.feed_farm_transfer_items(feed_farm_transfer_id);
create index if not exists feed_farm_transfer_items_source_batch_idx
  on public.feed_farm_transfer_items(item_code, source_batch_number);

alter table public.feed_farm_transfers enable row level security;
alter table public.feed_farm_transfer_items enable row level security;

drop policy if exists feed_farm_transfers_select_authorized on public.feed_farm_transfers;
create policy feed_farm_transfers_select_authorized
  on public.feed_farm_transfers for select to authenticated
  using (
    public.current_user_has_farm_permission('/brd/feed-farm-transfer/approval')
    or exists (
      select 1
      from public.users actor
      join public.users_farms assignment on assignment.users_id = actor.id
      where actor.auth_id = auth.uid()
        and btrim(coalesce(assignment.void::text, '0')) = '1'
        and assignment.farm_id in (source_farm_id, destination_farm_id)
    )
  );

drop policy if exists feed_farm_transfer_items_select_authorized on public.feed_farm_transfer_items;
create policy feed_farm_transfer_items_select_authorized
  on public.feed_farm_transfer_items for select to authenticated
  using (
    exists (
      select 1 from public.feed_farm_transfers transfer
      where transfer.id = feed_farm_transfer_id
    )
  );

revoke insert, update, delete on public.feed_farm_transfers from anon, authenticated;
revoke insert, update, delete on public.feed_farm_transfer_items from anon, authenticated;
grant select on public.feed_farm_transfers to authenticated;
grant select on public.feed_farm_transfer_items to authenticated;

create or replace function public.save_feed_farm_transfer(
  p_document jsonb,
  p_submit boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_id bigint;
  v_existing public.feed_farm_transfers%rowtype;
  v_source public.farms%rowtype;
  v_destination public.farms%rowtype;
  v_source_warehouse public.i_warehouse%rowtype;
  v_destination_warehouse public.i_warehouse%rowtype;
  v_line jsonb;
  v_item public.items%rowtype;
  v_batch public.item_batches%rowtype;
  v_line_no integer := 0;
  v_transfer_date date;
  v_source_farm_id bigint;
  v_destination_farm_id bigint;
  v_has_both_farms boolean := false;
  v_is_super_user boolean := false;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;

  v_id := nullif(p_document ->> 'id', '')::bigint;
  if v_id is null then
    if not public.current_user_has_farm_permission('/brd/feed-farm-transfer/insert') then
      raise exception 'You do not have permission to create Feed Farm Transfers.';
    end if;
  else
    if not public.current_user_has_farm_permission('/brd/feed-farm-transfer/edit') then
      raise exception 'You do not have permission to edit Feed Farm Transfers.';
    end if;
    select * into v_existing from public.feed_farm_transfers where id = v_id for update;
    if not found then raise exception 'Feed Farm Transfer % was not found.', v_id; end if;
    if v_existing.status <> 'Draft' then raise exception 'Only Draft Feed Farm Transfers can be changed.'; end if;
  end if;

  v_transfer_date := nullif(p_document ->> 'transferDate', '')::date;
  v_source_farm_id := nullif(p_document ->> 'sourceFarmId', '')::bigint;
  v_destination_farm_id := nullif(p_document ->> 'destinationFarmId', '')::bigint;
  if v_transfer_date is null then raise exception 'Transfer Date is required.'; end if;
  if v_source_farm_id is null or v_destination_farm_id is null then raise exception 'Source and Destination Farms are required.'; end if;
  if v_source_farm_id = v_destination_farm_id then raise exception 'Source and Destination Farms must be different.'; end if;

  select * into v_source from public.farms
  where id = v_source_farm_id and btrim(coalesce(void::text, '0')) = '1'
    and approval_status = 'approved' and upper(btrim(farm_type)) in ('BR', 'BROILER');
  if not found then raise exception 'Select an active, approved Broiler source farm.'; end if;
  select * into v_destination from public.farms
  where id = v_destination_farm_id and btrim(coalesce(void::text, '0')) = '1'
    and approval_status = 'approved' and upper(btrim(farm_type)) in ('BR', 'BROILER');
  if not found then raise exception 'Select an active, approved Broiler destination farm.'; end if;

  select exists (
    select 1 from public.users actor
    join public.users_farms source_assignment on source_assignment.users_id = actor.id
      and source_assignment.farm_id = v_source.id and btrim(coalesce(source_assignment.void::text, '0')) = '1'
    join public.users_farms destination_assignment on destination_assignment.users_id = actor.id
      and destination_assignment.farm_id = v_destination.id and btrim(coalesce(destination_assignment.void::text, '0')) = '1'
    where actor.auth_id = v_actor
  ) into v_has_both_farms;

  select exists (
    select 1 from public.users
    where auth_id = v_actor and coalesce(user_type, 3) = 1
  ) into v_is_super_user;

  if not v_has_both_farms and not v_is_super_user then
    raise exception 'You must be assigned to both the source and destination farms.';
  end if;

  select * into v_source_warehouse from public.i_warehouse
  where farm_id = v_source.id and is_default_feed_warehouse and is_active limit 1;
  if not found then raise exception 'The source farm has no active default feed storage.'; end if;
  select * into v_destination_warehouse from public.i_warehouse
  where farm_id = v_destination.id and is_default_feed_warehouse and is_active limit 1;
  if not found then raise exception 'The destination farm has no active default feed storage.'; end if;

  if jsonb_typeof(coalesce(p_document -> 'lines', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_document -> 'lines', '[]'::jsonb)) = 0 then
    raise exception 'Add at least one feed line.';
  end if;

  if v_id is null then
    insert into public.feed_farm_transfers(
      transfer_no, transfer_date, source_farm_id, source_farm_code, source_farm_name,
      destination_farm_id, destination_farm_code, destination_farm_name,
      source_warehouse_id, source_warehouse_code, source_warehouse_name,
      destination_warehouse_id, destination_warehouse_code, destination_warehouse_name,
      status, remarks, requested_by, requested_at, created_by
    ) values (
      'PENDING-' || txid_current()::text || '-' || floor(random() * 1000000)::text,
      v_transfer_date, v_source.id, v_source.code, v_source.name,
      v_destination.id, v_destination.code, v_destination.name,
      v_source_warehouse.id, v_source_warehouse.whse_code, v_source_warehouse.whse_name,
      v_destination_warehouse.id, v_destination_warehouse.whse_code, v_destination_warehouse.whse_name,
      case when p_submit then 'Pending Approval' else 'Draft' end,
      nullif(btrim(p_document ->> 'remarks'), ''),
      case when p_submit then v_actor else null end,
      case when p_submit then now() else null end,
      v_actor
    ) returning id into v_id;

    update public.feed_farm_transfers
    set transfer_no = 'FFT-' || to_char(v_transfer_date, 'YY') || '-' || lpad(v_id::text, 6, '0')
    where id = v_id;
  else
    update public.feed_farm_transfers set
      transfer_date = v_transfer_date,
      source_farm_id = v_source.id, source_farm_code = v_source.code, source_farm_name = v_source.name,
      destination_farm_id = v_destination.id, destination_farm_code = v_destination.code, destination_farm_name = v_destination.name,
      source_warehouse_id = v_source_warehouse.id, source_warehouse_code = v_source_warehouse.whse_code, source_warehouse_name = v_source_warehouse.whse_name,
      destination_warehouse_id = v_destination_warehouse.id, destination_warehouse_code = v_destination_warehouse.whse_code, destination_warehouse_name = v_destination_warehouse.whse_name,
      status = case when p_submit then 'Pending Approval' else 'Draft' end,
      remarks = nullif(btrim(p_document ->> 'remarks'), ''),
      requested_by = case when p_submit then v_actor else null end,
      requested_at = case when p_submit then now() else null end,
      updated_by = v_actor, updated_at = now()
    where id = v_id;
    delete from public.feed_farm_transfer_items where feed_farm_transfer_id = v_id;
  end if;

  for v_line in select value from jsonb_array_elements(p_document -> 'lines')
  loop
    v_line_no := v_line_no + 1;
    select * into v_item from public.items
    where id = nullif(v_line ->> 'itemId', '')::bigint
      and upper(btrim(item_code)) = upper(btrim(v_line ->> 'itemCode'))
      and btrim(coalesce(void::text, '0')) = '1' and coalesce(is_inventory_item, false);
    if not found then raise exception 'Line % has an invalid inventory item.', v_line_no; end if;

    select * into v_batch from public.item_batches
    where (item_id = v_item.id or upper(btrim(item_code)) = upper(btrim(v_item.item_code)))
      and upper(btrim(batch_number)) = upper(btrim(v_line ->> 'sourceBatchNumber'))
      and void = '1' and status = 'Active'
    order by id desc limit 1;
    if not found then raise exception 'Line % source batch is not active for %.', v_line_no, v_item.item_code; end if;
    if coalesce((v_line ->> 'quantity')::numeric, 0) <= 0 then raise exception 'Line % quantity must be greater than zero.', v_line_no; end if;

    insert into public.feed_farm_transfer_items(
      feed_farm_transfer_id, line_no, item_id, item_code, description,
      source_batch_number, manufacturing_date, expiry_date, base_qty, base_uom, created_by
    ) values (
      v_id, v_line_no, v_item.id, v_item.item_code, coalesce(v_item.item_name, v_item.description, v_item.item_code),
      v_batch.batch_number, v_batch.manufacturing_date, v_batch.expiry_date,
      (v_line ->> 'quantity')::numeric,
      coalesce(nullif(btrim(v_line ->> 'baseUom'), ''), nullif(btrim(v_item.inventory_uom), ''), nullif(btrim(v_item.unit_measure), ''), 'KG'),
      v_actor
    );
  end loop;

  return v_id;
end;
$$;

create or replace function public.approve_feed_farm_transfer(p_transfer_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_transfer public.feed_farm_transfers%rowtype;
  v_required record;
  v_available numeric;
  v_destination_batch text;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.current_user_has_farm_permission('/brd/feed-farm-transfer/approval') then
    raise exception 'You do not have permission to approve Feed Farm Transfers.';
  end if;

  select * into v_transfer from public.feed_farm_transfers where id = p_transfer_id for update;
  if not found then raise exception 'Feed Farm Transfer % was not found.', p_transfer_id; end if;
  if v_transfer.status = 'Approved' then return v_transfer.id; end if;
  if v_transfer.status <> 'Pending Approval' then raise exception 'Only submitted Feed Farm Transfers can be approved.'; end if;

  if not exists (
    select 1 from public.i_warehouse
    where id = v_transfer.source_warehouse_id and farm_id = v_transfer.source_farm_id
      and is_default_feed_warehouse and is_active
  ) or not exists (
    select 1 from public.i_warehouse
    where id = v_transfer.destination_warehouse_id and farm_id = v_transfer.destination_farm_id
      and is_default_feed_warehouse and is_active
  ) then
    raise exception 'A farm default feed storage changed after submission. Create a new transfer using the current defaults.';
  end if;

  for v_required in
    select item_code, source_batch_number, sum(base_qty) required_qty
    from public.feed_farm_transfer_items
    where feed_farm_transfer_id = v_transfer.id
    group by item_code, source_batch_number
  loop
    perform pg_advisory_xact_lock(hashtext(
      'feed-farm-transfer:' || upper(v_required.item_code) || ':' || upper(v_transfer.source_warehouse_code) || ':' || upper(v_required.source_batch_number)
    )::bigint);
    select coalesce(sum(case when upper(posting.transfer_type) = 'OUT' then -abs(posting.qty) else abs(posting.qty) end), 0)
    into v_available
    from public.inventory_postings posting
    where upper(btrim(posting.item_code)) = upper(btrim(v_required.item_code))
      and upper(btrim(posting.warehouse_code)) = upper(btrim(v_transfer.source_warehouse_code))
      and upper(btrim(coalesce(nullif(posting.batch_number, ''), nullif(posting.ref, ''), ''))) = upper(btrim(v_required.source_batch_number));
    if v_required.required_qty > v_available + 0.000001 then
      raise exception '% batch % has only % on hand in %.', v_required.item_code, v_required.source_batch_number, v_available, v_transfer.source_warehouse_code;
    end if;
  end loop;

  v_destination_batch := 'FR-' || v_transfer.id::text;

  insert into public.item_batches(
    item_id, item_code, batch_number, manufacturing_date, expiry_date, status, void, created_by
  )
  select line.item_id, line.item_code, v_destination_batch,
    min(line.manufacturing_date), min(line.expiry_date), 'Active', '1', v_actor
  from public.feed_farm_transfer_items line
  where line.feed_farm_transfer_id = v_transfer.id
    and not exists (
      select 1 from public.item_batches batch
      where batch.item_id = line.item_id and batch.batch_number = v_destination_batch and batch.void = '1'
    )
  group by line.item_id, line.item_code;

  update public.feed_farm_transfer_items
  set destination_batch_number = v_destination_batch, updated_by = v_actor, updated_at = now()
  where feed_farm_transfer_id = v_transfer.id;

  insert into public.inventory_postings(
    source_doc_type, source_docentry, item_code, warehouse_code, bin_code, batch_number,
    qty, created_by, ref_type, ref, transfer_type, ref_type2, ref2
  )
  select 'FEED_FARM_TRANSFER', v_transfer.id, line.item_code, movement.warehouse_code,
    'MAIN SUB BIN', movement.batch_number, line.base_qty, v_actor,
    'batch_code', movement.batch_number, movement.transfer_type,
    'feed_farm_transfer_batch', movement.trace_batch
  from public.feed_farm_transfer_items line
  cross join lateral (
    values
      ('OUT'::text, v_transfer.source_warehouse_code, line.source_batch_number, v_destination_batch),
      ('IN'::text, v_transfer.destination_warehouse_code, v_destination_batch, line.source_batch_number)
  ) movement(transfer_type, warehouse_code, batch_number, trace_batch)
  where line.feed_farm_transfer_id = v_transfer.id;

  update public.feed_farm_transfers
  set status = 'Approved', approved_by = v_actor, approved_at = now(), posting_version = posting_version + 1,
      updated_by = v_actor, updated_at = now()
  where id = v_transfer.id
  returning * into v_transfer;

  insert into public.notification_outbox(
    module_key, event_key, entity_type, entity_id, document_no, fms_type,
    farm_id, recipient_farm_id, actor_auth_id, target_url, permission_group, permission_title,
    title, message, posting_version, metadata, dedupe_key, occurred_at
  ) values (
    'FEED_FARM_TRANSFER', 'FEED_FARM_TRANSFER_POSTED', 'feed_farm_transfers', v_transfer.id::text,
    v_transfer.transfer_no, 'Broiler', v_transfer.source_farm_id, v_transfer.destination_farm_id,
    v_actor, '/brd/feed-farm-transfer', 'Menus', 'Feed Farm Transfer/view',
    'Feed Farm Transfer approved', v_transfer.transfer_no || ' was approved and inventory was transferred.',
    v_transfer.posting_version,
    jsonb_build_object('status', 'Approved', 'originFarmId', v_transfer.source_farm_id, 'destinationFarmId', v_transfer.destination_farm_id),
    'FEED_FARM_TRANSFER_POSTED:' || v_transfer.id || ':' || v_transfer.posting_version, now()
  ) on conflict (dedupe_key) do nothing;

  return v_transfer.id;
end;
$$;

revoke all on function public.save_feed_farm_transfer(jsonb, boolean) from public, anon;
revoke all on function public.approve_feed_farm_transfer(bigint) from public, anon;
grant execute on function public.save_feed_farm_transfer(jsonb, boolean) to authenticated;
grant execute on function public.approve_feed_farm_transfer(bigint) to authenticated;
