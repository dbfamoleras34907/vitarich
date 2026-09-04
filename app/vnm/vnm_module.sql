-- Vaccination and Meds (VNM)
-- Apply after the inventory, Item Group, farm-cycle and notification migrations.
begin;

create table if not exists public.vnm_settings (
  id bigint generated always as identity primary key,
  fms_type text not null check (fms_type in ('Broiler', 'Breeder')),
  medication_group_id bigint null references public.item_groups(id),
  auto_batch_selection boolean not null default true,
  allow_historical_cycle_selection boolean not null default false,
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  updated_at timestamptz null,
  constraint vnm_settings_fms_type_key unique (fms_type)
);

create table if not exists public.vnm_routes (
  id bigint generated always as identity primary key,
  name text not null,
  void text not null default '1' check (void in ('0', '1')),
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  updated_at timestamptz null
);
create unique index if not exists vnm_routes_active_name_uidx on public.vnm_routes(lower(btrim(name))) where void = '1';

create table if not exists public.vnm_indications (
  id bigint generated always as identity primary key,
  name text not null,
  void text not null default '1' check (void in ('0', '1')),
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  updated_at timestamptz null
);
create unique index if not exists vnm_indications_active_name_uidx on public.vnm_indications(lower(btrim(name))) where void = '1';

create table if not exists public.vnm_documents (
  id bigint generated always as identity primary key,
  document_no text not null unique,
  farm_id bigint not null references public.farms(id),
  farm_code text null,
  farm_name text null,
  fms_type text not null check (fms_type in ('Broiler', 'Breeder')),
  farm_cycle_id bigint null references public.doc_farm_cycles(id),
  cycle_no bigint null,
  storage_warehouse_id bigint not null references public.i_warehouse(id),
  storage_warehouse_code text null,
  storage_warehouse_name text null,
  created_date date not null default current_date,
  status text not null default 'Draft' check (status in ('Draft', 'Posted', 'Void')),
  remarks text null,
  edit_version integer not null default 0 check (edit_version >= 0),
  last_edit_action_id uuid null,
  posting_version integer not null default 0 check (posting_version >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  updated_at timestamptz null,
  posted_by uuid null references auth.users(id),
  posted_at timestamptz null,
  voided_by uuid null references auth.users(id),
  voided_at timestamptz null
);
alter table public.vnm_documents add column if not exists last_edit_action_id uuid null;
create unique index if not exists vnm_documents_last_edit_action_uidx on public.vnm_documents(last_edit_action_id) where last_edit_action_id is not null;
create index if not exists vnm_documents_farm_idx on public.vnm_documents(farm_id, created_at desc);
create index if not exists vnm_documents_status_idx on public.vnm_documents(status);

create table if not exists public.vnm_lines (
  id bigint generated always as identity primary key,
  vnm_document_id bigint not null references public.vnm_documents(id) on delete cascade,
  line_no integer not null check (line_no > 0),
  building_warehouse_id bigint not null references public.i_warehouse(id),
  building_code text null,
  building_name text null,
  pen_warehouse_id bigint null references public.i_warehouse(id),
  pen_code text null,
  pen_name text null,
  treatment_date date not null,
  treatment_period_days integer not null check (treatment_period_days > 0),
  item_id bigint not null references public.items(id),
  medication_code text not null,
  medication_name text not null,
  medication_type text null,
  quantity numeric(18,6) not null check (quantity > 0),
  uom text not null,
  base_quantity numeric(18,6) not null check (base_quantity > 0),
  base_uom text not null,
  indication_id bigint not null references public.vnm_indications(id),
  indication text not null,
  route_id bigint not null references public.vnm_routes(id),
  route text not null,
  bird_quantity_treated numeric(18,6) null check (bird_quantity_treated is null or bird_quantity_treated > 0),
  administered_by text null,
  withdrawal_period_days integer null check (withdrawal_period_days is null or withdrawal_period_days >= 0),
  remarks text null,
  void text not null default '1' check (void in ('0', '1')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  updated_at timestamptz null,
  constraint vnm_lines_document_line_key unique (vnm_document_id, line_no)
);
create index if not exists vnm_lines_document_idx on public.vnm_lines(vnm_document_id);
create index if not exists vnm_lines_item_idx on public.vnm_lines(item_id);

create table if not exists public.vnm_line_batches (
  id bigint generated always as identity primary key,
  vnm_line_id bigint not null references public.vnm_lines(id) on delete cascade,
  allocation_no integer not null check (allocation_no > 0),
  batch_number text null,
  base_quantity numeric(18,6) not null check (base_quantity > 0),
  void text not null default '1' check (void in ('0', '1')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint vnm_line_batches_line_allocation_key unique (vnm_line_id, allocation_no)
);
create index if not exists vnm_line_batches_line_idx on public.vnm_line_batches(vnm_line_id);

create or replace function public.vnm_is_superuser()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users app_user
    where app_user.auth_id = auth.uid() and coalesce(app_user.user_type, 3) = 1
      and btrim(coalesce(app_user.isactive::text, '0')) = '1'
  );
$$;

create or replace function public.vnm_can_access_farm(p_farm_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select public.vnm_is_superuser() or exists (
    select 1
    from public.users app_user
    join public.users_farms assignment on assignment.users_id = app_user.id
    left join public.farms legacy_farm on legacy_farm.code = assignment.farm_code
    where app_user.auth_id = auth.uid()
      and btrim(coalesce(app_user.isactive::text, '0')) = '1'
      and btrim(coalesce(assignment.void::text, '0')) = '1'
      and coalesce(assignment.farm_id, legacy_farm.id) = p_farm_id
  );
$$;

create or replace function public.vnm_has_permission(p_title text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.vnm_is_superuser() or exists (
    select 1 from public.user_permissions permission
    where permission.user_id = auth.uid()
      and permission.group_name = 'Animal Health'
      and permission.title = p_title
      and permission.is_visible
  );
$$;

alter table public.vnm_settings enable row level security;
alter table public.vnm_routes enable row level security;
alter table public.vnm_indications enable row level security;
alter table public.vnm_documents enable row level security;
alter table public.vnm_lines enable row level security;
alter table public.vnm_line_batches enable row level security;

drop policy if exists vnm_settings_select on public.vnm_settings;
create policy vnm_settings_select on public.vnm_settings for select to authenticated using (true);
drop policy if exists vnm_routes_select on public.vnm_routes;
create policy vnm_routes_select on public.vnm_routes for select to authenticated using (true);
drop policy if exists vnm_indications_select on public.vnm_indications;
create policy vnm_indications_select on public.vnm_indications for select to authenticated using (true);
drop policy if exists vnm_documents_select on public.vnm_documents;
create policy vnm_documents_select on public.vnm_documents for select to authenticated using (
  public.vnm_has_permission('Vaccination and Meds/view') and public.vnm_can_access_farm(farm_id)
);
drop policy if exists vnm_lines_select on public.vnm_lines;
create policy vnm_lines_select on public.vnm_lines for select to authenticated using (
  public.vnm_has_permission('Vaccination and Meds/view') and exists (select 1 from public.vnm_documents document where document.id = vnm_document_id and public.vnm_can_access_farm(document.farm_id))
);
drop policy if exists vnm_line_batches_select on public.vnm_line_batches;
create policy vnm_line_batches_select on public.vnm_line_batches for select to authenticated using (
  exists (
    select 1 from public.vnm_lines line join public.vnm_documents document on document.id = line.vnm_document_id
    where line.id = vnm_line_id and public.vnm_has_permission('Vaccination and Meds/view') and public.vnm_can_access_farm(document.farm_id)
  )
);

grant select on public.vnm_settings, public.vnm_routes, public.vnm_indications, public.vnm_documents, public.vnm_lines, public.vnm_line_batches to authenticated;

create or replace function public.save_vnm_settings(
  p_fms_type text,
  p_medication_group_id bigint,
  p_auto_batch_selection boolean,
  p_allow_historical_cycle_selection boolean
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.vnm_is_superuser() then raise exception 'Only a Super Admin can edit Vaccination and Meds settings.'; end if;
  if p_fms_type not in ('Broiler', 'Breeder') then raise exception 'Unsupported FMS type.'; end if;
  if p_medication_group_id is null or not exists (select 1 from public.item_groups where id = p_medication_group_id and void = '1') then
    raise exception 'Select an active Medication Group.';
  end if;
  insert into public.vnm_settings(fms_type, medication_group_id, auto_batch_selection, allow_historical_cycle_selection, created_by)
  values (p_fms_type, p_medication_group_id, coalesce(p_auto_batch_selection, false), coalesce(p_allow_historical_cycle_selection, false), auth.uid())
  on conflict (fms_type) do update set medication_group_id = excluded.medication_group_id,
    auto_batch_selection = excluded.auto_batch_selection,
    allow_historical_cycle_selection = excluded.allow_historical_cycle_selection,
    updated_by = auth.uid(), updated_at = now();
end;
$$;

create or replace function public.save_vnm_master_value(p_master text, p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text := btrim(coalesce(p_name, ''));
begin
  if not public.vnm_is_superuser() then raise exception 'Only a Super Admin can edit Vaccination and Meds master data.'; end if;
  if v_name = '' then raise exception 'Enter a name.'; end if;
  if lower(p_master) = 'route' then
    insert into public.vnm_routes(name, created_by) values (v_name, auth.uid());
  elsif lower(p_master) = 'indication' then
    insert into public.vnm_indications(name, created_by) values (v_name, auth.uid());
  else raise exception 'Unsupported master data type.';
  end if;
end;
$$;

create or replace function public.void_vnm_master_value(p_master text, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.vnm_is_superuser() then raise exception 'Only a Super Admin can edit Vaccination and Meds master data.'; end if;
  if lower(p_master) = 'route' then
    update public.vnm_routes set void = '0', updated_by = auth.uid(), updated_at = now() where id = p_id and void = '1';
  elsif lower(p_master) = 'indication' then
    update public.vnm_indications set void = '0', updated_by = auth.uid(), updated_at = now() where id = p_id and void = '1';
  else raise exception 'Unsupported master data type.';
  end if;
end;
$$;

create or replace function public.save_vnm_draft(p_document jsonb, p_action_id uuid, p_emit_edit boolean default true)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_id bigint := nullif(p_document->>'id', '')::bigint;
  v_existing public.vnm_documents%rowtype;
  v_farm public.farms%rowtype;
  v_fms_type text;
  v_setting public.vnm_settings%rowtype;
  v_cycle public.doc_farm_cycles%rowtype;
  v_storage public.i_warehouse%rowtype;
  v_line jsonb;
  v_line_id bigint;
  v_line_no integer := 0;
  v_building public.i_warehouse%rowtype;
  v_pen public.i_warehouse%rowtype;
  v_item public.items%rowtype;
  v_effective_group_id bigint;
  v_medication_type text;
  v_indication public.vnm_indications%rowtype;
  v_route public.vnm_routes%rowtype;
  v_multiplier numeric;
  v_base_uom text;
  v_base_quantity numeric;
  v_allocation jsonb;
  v_allocation_no integer;
  v_allocation_total numeric;
  v_document_no text;
  v_sequence bigint;
  v_edit_version integer;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if p_action_id is null then raise exception 'An action ID is required.'; end if;
  select * into v_existing from public.vnm_documents where last_edit_action_id = p_action_id;
  if found then
    if not public.vnm_can_access_farm(v_existing.farm_id) then raise exception 'Vaccination and Meds document was not found.'; end if;
    return v_existing.id;
  end if;
  select * into v_farm from public.farms where id = nullif(p_document->>'farmId', '')::bigint and void = 1 and approval_status = 'approved';
  if not found or not public.vnm_can_access_farm(v_farm.id) then raise exception 'The selected farm is unavailable.'; end if;
  v_fms_type := case upper(btrim(coalesce(v_farm.farm_type, ''))) when 'BR' then 'Broiler' when 'BROILER' then 'Broiler' when 'BE' then 'Breeder' when 'BREEDER' then 'Breeder' else null end;
  if v_fms_type is null then raise exception 'Vaccination and Meds currently supports Broiler and Breeder farms only.'; end if;
  select * into v_setting from public.vnm_settings where fms_type = v_fms_type;
  if not found or v_setting.medication_group_id is null then raise exception 'Vaccination and Meds settings are incomplete for %.', v_fms_type; end if;

  select * into v_storage from public.i_warehouse where id = nullif(p_document->>'storageWarehouseId', '')::bigint and farm_id = v_farm.id and is_active and warehouse_type = 'Warehouse';
  if not found then raise exception 'Select an active Medication Storage Warehouse from the document farm.'; end if;

  if v_fms_type = 'Broiler' then
    if nullif(p_document->>'farmCycleId', '') is null then
      select * into v_cycle from public.doc_farm_cycles where farm_id = v_farm.id and status = 'Saved' order by id desc limit 1;
    else
      select * into v_cycle from public.doc_farm_cycles where id = (p_document->>'farmCycleId')::bigint and farm_id = v_farm.id
        and status in ('Saved', 'Closed')
        and (v_setting.allow_historical_cycle_selection or status = 'Saved');
    end if;
    if not found then raise exception 'No eligible Farm Cycle is available for the selected Broiler farm.'; end if;
  else
    v_cycle := null;
  end if;

  if v_id is not null then
    if not public.vnm_has_permission('Vaccination and Meds/edit') then raise exception 'You do not have permission to edit this document.'; end if;
    select * into v_existing from public.vnm_documents where id = v_id for update;
    if not found or not public.vnm_can_access_farm(v_existing.farm_id) then raise exception 'Vaccination and Meds document was not found.'; end if;
    if v_existing.status <> 'Draft' then raise exception 'Only Draft documents can be edited.'; end if;
    if v_existing.last_edit_action_id = p_action_id then return v_existing.id; end if;
    v_document_no := v_existing.document_no;
    v_edit_version := v_existing.edit_version + 1;
    update public.vnm_documents set farm_id = v_farm.id, farm_code = v_farm.code, farm_name = v_farm.name, fms_type = v_fms_type,
      farm_cycle_id = case when v_fms_type = 'Broiler' then v_cycle.id else null end,
      cycle_no = case when v_fms_type = 'Broiler' then v_cycle.cycle_no else null end,
      storage_warehouse_id = v_storage.id, storage_warehouse_code = v_storage.whse_code, storage_warehouse_name = v_storage.whse_name,
      remarks = nullif(btrim(p_document->>'remarks'), ''), edit_version = v_edit_version, last_edit_action_id = p_action_id,
      updated_by = auth.uid(), updated_at = now()
    where id = v_id;
    delete from public.vnm_lines where vnm_document_id = v_id;
  else
    if not public.vnm_has_permission('Vaccination and Meds/insert') then raise exception 'You do not have permission to create this document.'; end if;
    perform pg_advisory_xact_lock(hashtext('public.vnm_documents:number')::bigint);
    select coalesce(max(substring(document_no from '^VM-([0-9]{7})$')::bigint), 0) + 1 into v_sequence from public.vnm_documents;
    if v_sequence > 9999999 then raise exception 'The VM document number range is exhausted.'; end if;
    v_document_no := 'VM-' || lpad(v_sequence::text, 7, '0');
    insert into public.vnm_documents(document_no, farm_id, farm_code, farm_name, fms_type, farm_cycle_id, cycle_no,
      storage_warehouse_id, storage_warehouse_code, storage_warehouse_name, remarks, last_edit_action_id, created_by)
    values (v_document_no, v_farm.id, v_farm.code, v_farm.name, v_fms_type,
      case when v_fms_type = 'Broiler' then v_cycle.id else null end, case when v_fms_type = 'Broiler' then v_cycle.cycle_no else null end,
      v_storage.id, v_storage.whse_code, v_storage.whse_name, nullif(btrim(p_document->>'remarks'), ''), p_action_id, auth.uid()) returning id into v_id;
    v_edit_version := 0;
  end if;

  if jsonb_typeof(p_document->'lines') <> 'array' or jsonb_array_length(p_document->'lines') = 0 then raise exception 'Add at least one medication line.'; end if;
  for v_line in select value from jsonb_array_elements(p_document->'lines') loop
    v_line_no := v_line_no + 1;
    select * into v_building from public.i_warehouse where id = nullif(v_line->>'buildingWarehouseId', '')::bigint
      and farm_id = v_farm.id and is_active and warehouse_type = 'Building';
    if not found then raise exception 'Line %: select an active Building from the document farm.', v_line_no; end if;
    if v_fms_type = 'Broiler' and not exists (
      select 1 from public.flock_card card where card.farm_cycle_id = v_cycle.id and card.building_whse_id = v_building.id and card.void = '1'
    ) then raise exception 'Line %: the selected Building does not belong to the selected Farm Cycle.', v_line_no; end if;
    if exists (select 1 from public.i_warehouse where father_id = v_building.id and warehouse_type = 'Pen' and is_active) then
      select * into v_pen from public.i_warehouse where id = nullif(v_line->>'penWarehouseId', '')::bigint and father_id = v_building.id and warehouse_type = 'Pen' and is_active;
      if not found then raise exception 'Line %: Pen is required for the selected Building.', v_line_no; end if;
    else
      v_pen := null;
    end if;

    select * into v_item from public.items where id = nullif(v_line->>'itemId', '')::bigint and void = 1 and is_inventory_item
      and lower(btrim(fms_group)) = lower(v_fms_type);
    if not found then raise exception 'Line %: select an active medication inventory item for %.', v_line_no, v_fms_type; end if;
    select id into v_effective_group_id from public.item_groups where code = v_item.item_group and void = '1' limit 1;
    v_effective_group_id := coalesce(v_item.sub_item_group_level_3_id, v_item.sub_item_group_level_2_id, v_item.sub_item_group_level_1_id, v_item.sub_item_group_id, v_effective_group_id);
    if not exists (
      with recursive allowed as (
        select id from public.item_groups where id = v_setting.medication_group_id and void = '1'
        union all select child.id from public.item_groups child join allowed parent on child.father = parent.id where child.void = '1'
      ) select 1 from allowed where id = v_effective_group_id
    ) then raise exception 'Line %: the item is outside the configured Medication Group.', v_line_no; end if;
    select name into v_medication_type from public.item_groups where id = v_effective_group_id;

    select * into v_indication from public.vnm_indications where id = nullif(v_line->>'indicationId', '')::bigint and void = '1';
    if not found then raise exception 'Line %: select an active Indication.', v_line_no; end if;
    select * into v_route from public.vnm_routes where id = nullif(v_line->>'routeId', '')::bigint and void = '1';
    if not found then raise exception 'Line %: select an active Route.', v_line_no; end if;
    if nullif(v_line->>'treatmentDate', '') is null or coalesce((v_line->>'treatmentPeriodDays')::integer, 0) <= 0 then
      raise exception 'Line %: enter a Treatment Start Date and positive Treatment Period.', v_line_no;
    end if;

    v_base_uom := btrim(coalesce(v_item.inventory_uom, ''));
    if upper(btrim(v_line->>'uom')) = upper(v_base_uom) then v_multiplier := 1;
    else
      select conversion.base_qty into v_multiplier
      from public.uom_groups uom_group
      join public.uom_group_conversions conversion on conversion.uom_group_id = uom_group.id and conversion.void = '1'
      join public.uom_master_data uom on uom.id = conversion.uom_id and uom.void = '1'
      where uom_group.code = v_item.uom_group_code and uom_group.void = '1' and upper(uom.code) = upper(btrim(v_line->>'uom')) limit 1;
    end if;
    if coalesce(v_multiplier, 0) <= 0 or coalesce((v_line->>'quantity')::numeric, 0) <= 0 then raise exception 'Line %: enter a valid Quantity and UoM.', v_line_no; end if;
    v_base_quantity := round((v_line->>'quantity')::numeric * v_multiplier, 6);

    insert into public.vnm_lines(vnm_document_id, line_no, building_warehouse_id, building_code, building_name, pen_warehouse_id, pen_code, pen_name,
      treatment_date, treatment_period_days, item_id, medication_code, medication_name, medication_type, quantity, uom, base_quantity, base_uom,
      indication_id, indication, route_id, route, bird_quantity_treated, administered_by, withdrawal_period_days, remarks, created_by)
    values (v_id, v_line_no, v_building.id, v_building.whse_code, v_building.whse_name, v_pen.id, v_pen.whse_code, v_pen.whse_name,
      (v_line->>'treatmentDate')::date, (v_line->>'treatmentPeriodDays')::integer, v_item.id, v_item.item_code, v_item.item_name, v_medication_type,
      (v_line->>'quantity')::numeric, btrim(v_line->>'uom'), v_base_quantity, v_base_uom, v_indication.id, v_indication.name, v_route.id, v_route.name,
      nullif(v_line->>'birdQuantityTreated', '')::numeric, nullif(btrim(v_line->>'administeredBy'), ''), nullif(v_line->>'withdrawalPeriodDays', '')::integer,
      nullif(btrim(v_line->>'remarks'), ''), auth.uid()) returning id into v_line_id;

    v_allocation_no := 0; v_allocation_total := 0;
    if jsonb_typeof(v_line->'allocations') = 'array' then
      for v_allocation in select value from jsonb_array_elements(v_line->'allocations') loop
        v_allocation_no := v_allocation_no + 1;
        if coalesce((v_allocation->>'baseQty')::numeric, 0) <= 0 then raise exception 'Line %: batch allocation must be positive.', v_line_no; end if;
        if v_item.manage_batch_numbers and nullif(btrim(v_allocation->>'batchNumber'), '') is null then raise exception 'Line %: Batch is required.', v_line_no; end if;
        insert into public.vnm_line_batches(vnm_line_id, allocation_no, batch_number, base_quantity, created_by)
        values (v_line_id, v_allocation_no, nullif(btrim(v_allocation->>'batchNumber'), ''), (v_allocation->>'baseQty')::numeric, auth.uid());
        v_allocation_total := v_allocation_total + (v_allocation->>'baseQty')::numeric;
      end loop;
    end if;
    if v_allocation_no = 0 then
      if v_item.manage_batch_numbers then raise exception 'Line %: allocate a Batch.', v_line_no; end if;
      insert into public.vnm_line_batches(vnm_line_id, allocation_no, batch_number, base_quantity, created_by) values (v_line_id, 1, null, v_base_quantity, auth.uid());
      v_allocation_total := v_base_quantity;
    end if;
    if abs(v_allocation_total - v_base_quantity) > 0.000001 then raise exception 'Line %: allocated quantity does not match the requested quantity.', v_line_no; end if;
  end loop;

  if v_existing.id is not null and p_emit_edit then
    insert into public.notification_outbox(module_key, event_key, entity_type, entity_id, document_no, fms_type, farm_id, recipient_farm_id,
      actor_auth_id, target_url, permission_group, permission_title, title, message, metadata, dedupe_key, occurred_at)
    values ('VACCINATION_MEDS', 'VACCINATION_MEDS_EDITED', 'vnm_document', v_id::text, v_document_no, v_fms_type, v_farm.id, v_farm.id,
      auth.uid(), '/vnm/view/' || v_id, 'Animal Health', 'Vaccination and Meds/view', 'Vaccination and Meds draft edited', v_document_no || ' was edited.',
      jsonb_build_object('status', 'Draft', 'changedFields', jsonb_build_array('farm', 'cycle', 'warehouse', 'remarks', 'lines'), 'editVersion', v_edit_version),
      'VACCINATION_MEDS_EDITED:' || v_id || ':' || v_edit_version, now()) on conflict (dedupe_key) do nothing;
  end if;
  return v_id;
end;
$$;

create or replace function public.post_vnm_document(p_document_id bigint, p_action_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_document public.vnm_documents%rowtype; v_required record; v_available numeric; v_line_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not (public.vnm_has_permission('Vaccination and Meds/insert') or public.vnm_has_permission('Vaccination and Meds/edit')) then raise exception 'You do not have permission to post this document.'; end if;
  select * into v_document from public.vnm_documents where id = p_document_id for update;
  if not found or not public.vnm_can_access_farm(v_document.farm_id) then raise exception 'Vaccination and Meds document was not found.'; end if;
  if v_document.status = 'Posted' then return; end if;
  if v_document.status <> 'Draft' then raise exception 'Only a Draft document can be posted.'; end if;
  select count(*) into v_line_count from public.vnm_lines where vnm_document_id = v_document.id and void = '1';
  if v_line_count = 0 then raise exception 'Add at least one medication line.'; end if;

  for v_required in
    select line.medication_code, document.storage_warehouse_code warehouse_code, batch.batch_number, sum(batch.base_quantity) required_qty
    from public.vnm_documents document join public.vnm_lines line on line.vnm_document_id = document.id and line.void = '1'
    join public.vnm_line_batches batch on batch.vnm_line_id = line.id and batch.void = '1'
    where document.id = v_document.id group by line.medication_code, document.storage_warehouse_code, batch.batch_number
  loop
    perform pg_advisory_xact_lock(hashtext('inventory:' || v_required.medication_code || ':' || v_required.warehouse_code || ':' || coalesce(v_required.batch_number, ''))::bigint);
    select coalesce(sum(case when posting.transfer_type = 'OUT' then -posting.qty else posting.qty end), 0) into v_available
    from public.inventory_postings posting where posting.item_code = v_required.medication_code and posting.warehouse_code = v_required.warehouse_code
      and coalesce(posting.batch_number, posting.ref, '') = coalesce(v_required.batch_number, '');
    if v_required.required_qty > v_available then raise exception '% batch % has only % on hand in %.', v_required.medication_code, coalesce(v_required.batch_number, '(none)'), v_available, v_required.warehouse_code; end if;
  end loop;

  insert into public.inventory_postings(source_doc_type, source_docentry, item_code, warehouse_code, bin_code, batch_number, qty, created_by,
    ref_type, ref, transfer_type, ref_type2, ref2)
  select 'VACCINATION_MEDS', v_document.id, line.medication_code, v_document.storage_warehouse_code, 'MAIN SUB BIN', batch.batch_number,
    sum(batch.base_quantity), auth.uid(), 'batch_code', batch.batch_number, 'OUT', 'document_no', v_document.document_no
  from public.vnm_lines line join public.vnm_line_batches batch on batch.vnm_line_id = line.id and batch.void = '1'
  where line.vnm_document_id = v_document.id and line.void = '1' group by line.medication_code, batch.batch_number;

  update public.vnm_documents set status = 'Posted', posting_version = posting_version + 1, posted_by = auth.uid(), posted_at = now(), updated_by = auth.uid(), updated_at = now()
  where id = v_document.id returning * into v_document;
  insert into public.notification_outbox(module_key, event_key, entity_type, entity_id, document_no, fms_type, farm_id, recipient_farm_id,
    actor_auth_id, target_url, permission_group, permission_title, title, message, posting_version, metadata, dedupe_key, occurred_at)
  values ('VACCINATION_MEDS', 'VACCINATION_MEDS_POSTED', 'vnm_document', v_document.id::text, v_document.document_no, v_document.fms_type,
    v_document.farm_id, v_document.farm_id, auth.uid(), '/vnm/view/' || v_document.id, 'Animal Health', 'Vaccination and Meds/view',
    'Vaccination and Meds posted', v_document.document_no || ' was posted.', v_document.posting_version,
    jsonb_build_object('status', 'Posted', 'lineCount', v_line_count, 'warehouse', v_document.storage_warehouse_code),
    'VACCINATION_MEDS_POSTED:' || v_document.id || ':' || v_document.posting_version, now()) on conflict (dedupe_key) do nothing;
end;
$$;

create or replace function public.save_and_post_vnm_document(p_document jsonb, p_action_id uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  v_id := public.save_vnm_draft(p_document, p_action_id, false);
  perform public.post_vnm_document(v_id, p_action_id);
  return v_id;
end;
$$;

create or replace function public.void_vnm_document(p_document_id bigint, p_action_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_document public.vnm_documents%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not public.vnm_has_permission('Vaccination and Meds/void') then raise exception 'You do not have permission to void this document.'; end if;
  select * into v_document from public.vnm_documents where id = p_document_id for update;
  if not found or not public.vnm_can_access_farm(v_document.farm_id) then raise exception 'Vaccination and Meds document was not found.'; end if;
  if v_document.status = 'Void' then return; end if;
  if v_document.status <> 'Posted' then raise exception 'Only a Posted document can be voided.'; end if;
  insert into public.inventory_postings(source_doc_type, source_docentry, item_code, warehouse_code, bin_code, batch_number, qty, created_by,
    ref_type, ref, transfer_type, ref_type2, ref2)
  select 'VACCINATION_MEDS_VOID', v_document.id, posting.item_code, posting.warehouse_code, posting.bin_code, coalesce(posting.batch_number, posting.ref),
    posting.qty, auth.uid(), 'batch_code', coalesce(posting.batch_number, posting.ref), 'IN', 'document_no', v_document.document_no
  from public.inventory_postings posting where posting.source_doc_type = 'VACCINATION_MEDS' and posting.source_docentry = v_document.id and posting.transfer_type = 'OUT';
  update public.vnm_documents set status = 'Void', voided_by = auth.uid(), voided_at = now(), updated_by = auth.uid(), updated_at = now() where id = v_document.id returning * into v_document;
  insert into public.notification_outbox(module_key, event_key, entity_type, entity_id, document_no, fms_type, farm_id, recipient_farm_id,
    actor_auth_id, target_url, permission_group, permission_title, title, message, posting_version, metadata, dedupe_key, occurred_at)
  values ('VACCINATION_MEDS', 'VACCINATION_MEDS_VOIDED', 'vnm_document', v_document.id::text, v_document.document_no, v_document.fms_type,
    v_document.farm_id, v_document.farm_id, auth.uid(), '/vnm/view/' || v_document.id, 'Animal Health', 'Vaccination and Meds/view',
    'Vaccination and Meds voided', v_document.document_no || ' was voided.', v_document.posting_version,
    jsonb_build_object('status', 'Void'), 'VACCINATION_MEDS_VOIDED:' || v_document.id, now()) on conflict (dedupe_key) do nothing;
end;
$$;

revoke all on function public.save_vnm_settings(text,bigint,boolean,boolean) from public, anon;
revoke all on function public.save_vnm_master_value(text,text) from public, anon;
revoke all on function public.void_vnm_master_value(text,bigint) from public, anon;
revoke all on function public.save_vnm_draft(jsonb,uuid,boolean) from public, anon;
revoke all on function public.post_vnm_document(bigint,uuid) from public, anon;
revoke all on function public.save_and_post_vnm_document(jsonb,uuid) from public, anon;
revoke all on function public.void_vnm_document(bigint,uuid) from public, anon;
grant execute on function public.save_vnm_settings(text,bigint,boolean,boolean) to authenticated;
grant execute on function public.save_vnm_master_value(text,text) to authenticated;
grant execute on function public.void_vnm_master_value(text,bigint) to authenticated;
grant execute on function public.save_vnm_draft(jsonb,uuid,boolean) to authenticated;
grant execute on function public.post_vnm_document(bigint,uuid) to authenticated;
grant execute on function public.save_and_post_vnm_document(jsonb,uuid) to authenticated;
grant execute on function public.void_vnm_document(bigint,uuid) to authenticated;

commit;
