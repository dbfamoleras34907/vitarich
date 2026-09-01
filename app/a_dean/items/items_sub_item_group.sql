alter table public.items
  add column if not exists sub_item_group_id bigint null;

alter table public.items
  drop constraint if exists items_sub_item_group_id_fkey;

alter table public.items
  add constraint items_sub_item_group_id_fkey
  foreign key (sub_item_group_id)
  references public.item_groups (id);

create index if not exists items_sub_item_group_id_idx
  on public.items (sub_item_group_id);

create or replace function public.validate_item_sub_item_group()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.sub_item_group_id is null then
    return new;
  end if;

  -- Serialize Item assignment against adding a child or voiding the same
  -- group so the leaf-only rule cannot be bypassed by concurrent requests.
  perform 1
  from public.item_groups selected
  where selected.id = new.sub_item_group_id
  for update;

  if not exists (
    with recursive lineage as (
      select selected.id, selected.father, selected.code, selected.void::text as void, 1 as depth
      from public.item_groups selected
      where selected.id = new.sub_item_group_id

      union all

      select parent.id, parent.father, parent.code, parent.void::text, lineage.depth + 1
      from public.item_groups parent
      join lineage on parent.id = lineage.father
      where lineage.depth < 6
    )
    select 1
    from lineage root
    where root.father is null
      and upper(btrim(root.code)) = upper(btrim(coalesce(new.item_group, '')))
      and not exists (
        select 1 from lineage node
        where btrim(coalesce(node.void, '0')) <> '1'
      )
      and not exists (
        select 1 from public.item_groups child
        where child.father = new.sub_item_group_id
          and btrim(coalesce(child.void::text, '0')) = '1'
      )
  ) then
    raise exception 'The selected sub item group must be an active leaf under item group %.', new.item_group;
  end if;

  return new;
end;
$$;

drop trigger if exists items_validate_sub_item_group on public.items;
create trigger items_validate_sub_item_group
before insert or update of item_group, sub_item_group_id
on public.items
for each row
execute function public.validate_item_sub_item_group();

-- Item Master has Create and Edit operations. Keep the event hooks in this same script
-- so the trigger cannot be installed before sub_item_group_id exists.
-- public.notification_outbox is provided by
-- app/admin/notifications/notification_system.sql.
create or replace function public.enqueue_item_master_posted_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_auth_id uuid := auth.uid();
  v_fms_type text := case lower(btrim(coalesce(new.fms_group, '')))
    when 'broiler' then 'Broiler'
    when 'breeder' then 'Breeder'
    when 'hatchery' then 'Hatchery'
    else null
  end;
begin
  insert into public.notification_outbox (
    module_key, event_key, entity_type, entity_id, document_no,
    fms_type, farm_id, recipient_farm_id, actor_auth_id, target_url,
    permission_group, permission_title, title, message, priority,
    metadata, dedupe_key, occurred_at
  ) values (
    'ITEM_MASTER', 'ITEM_MASTER_POSTED', 'items', new.id::text, new.item_code,
    v_fms_type, null, null, v_actor_auth_id,
    '/a_dean/items/edit?id=' || new.id::text,
    'Menus', 'Item Master Data/view', 'Item created',
    'Item {document_no} was created by {initiator_name}.', 'normal',
    jsonb_build_object(
      'itemCode', new.item_code,
      'itemName', new.item_name,
      'itemGroup', new.item_group,
      'subItemGroupId', new.sub_item_group_id
    ),
    'ITEM_MASTER_POSTED:' || new.id::text,
    now()
  )
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

drop trigger if exists items_enqueue_posted_event on public.items;
create trigger items_enqueue_posted_event
after insert
on public.items
for each row
execute function public.enqueue_item_master_posted_event();

create or replace function public.enqueue_item_master_edited_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_auth_id uuid := auth.uid();
  v_fms_type text := case lower(btrim(coalesce(new.fms_group, '')))
    when 'broiler' then 'Broiler'
    when 'breeder' then 'Breeder'
    when 'hatchery' then 'Hatchery'
    else null
  end;
  v_changed_fields text[];
begin
  select coalesce(array_agg(changed.key order by changed.key), array[]::text[])
  into v_changed_fields
  from jsonb_each(to_jsonb(new)) changed
  join jsonb_each(to_jsonb(old)) previous using (key)
  where changed.value is distinct from previous.value
    and changed.key = any(array[
      'item_code', 'item_name', 'description', 'barcode', 'unit_measure',
      'inventory_uom', 'item_group', 'sub_item_group_id', 'fms_group', 'group',
      'is_inventory_item', 'is_sales_item', 'is_purchase_item',
      'is_delivery_item', 'manage_batch_numbers', 'manage_serial_numbers',
      'batch_management_method', 'default_shelf_life_days',
      'default_expiration_months', 'default_expiry_required',
      'allow_negative_batch_stock', 'batch_number_series', 'min_on_hand',
      'max_on_hand'
    ]::text[]);

  if cardinality(v_changed_fields) = 0 then
    return new;
  end if;

  insert into public.notification_outbox (
    module_key, event_key, entity_type, entity_id, document_no,
    fms_type, farm_id, recipient_farm_id, actor_auth_id, target_url,
    permission_group, permission_title, title, message, priority,
    metadata, dedupe_key, occurred_at
  ) values (
    'ITEM_MASTER', 'ITEM_MASTER_EDITED', 'items', new.id::text, new.item_code,
    v_fms_type, null, null, v_actor_auth_id,
    '/a_dean/items/edit?id=' || new.id::text,
    'Menus', 'Item Master Data/view', 'Item edited',
    'Item {document_no} was edited by {initiator_name}.', 'normal',
    jsonb_build_object(
      'itemCode', new.item_code,
      'itemName', new.item_name,
      'itemGroup', new.item_group,
      'subItemGroupId', new.sub_item_group_id,
      'changedFields', to_jsonb(v_changed_fields)
    ),
    'ITEM_MASTER_EDITED:' || new.id::text || ':' || txid_current()::text,
    now()
  )
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

drop trigger if exists items_enqueue_edited_event on public.items;
create trigger items_enqueue_edited_event
after update of
  item_code, item_name, description, barcode, unit_measure, inventory_uom,
  item_group, sub_item_group_id, fms_group, "group", is_inventory_item,
  is_sales_item, is_purchase_item, is_delivery_item, manage_batch_numbers,
  manage_serial_numbers, batch_management_method, default_shelf_life_days,
  default_expiration_months, default_expiry_required, allow_negative_batch_stock,
  batch_number_series, min_on_hand, max_on_hand
on public.items
for each row
execute function public.enqueue_item_master_edited_event();

notify pgrst, 'reload schema';
