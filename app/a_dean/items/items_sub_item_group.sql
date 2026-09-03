alter table public.items
  add column if not exists sub_item_group_id bigint null,
  add column if not exists sub_item_group_level_1_id bigint null,
  add column if not exists sub_item_group_level_2_id bigint null,
  add column if not exists sub_item_group_level_3_id bigint null;

alter table public.items
  drop constraint if exists items_sub_item_group_id_fkey,
  drop constraint if exists items_sub_item_group_level_1_id_fkey,
  drop constraint if exists items_sub_item_group_level_2_id_fkey,
  drop constraint if exists items_sub_item_group_level_3_id_fkey;

alter table public.items
  add constraint items_sub_item_group_id_fkey foreign key (sub_item_group_id) references public.item_groups (id),
  add constraint items_sub_item_group_level_1_id_fkey foreign key (sub_item_group_level_1_id) references public.item_groups (id),
  add constraint items_sub_item_group_level_2_id_fkey foreign key (sub_item_group_level_2_id) references public.item_groups (id),
  add constraint items_sub_item_group_level_3_id_fkey foreign key (sub_item_group_level_3_id) references public.item_groups (id);

create index if not exists items_sub_item_group_id_idx
  on public.items (sub_item_group_id);
create index if not exists items_sub_item_group_level_1_id_idx on public.items (sub_item_group_level_1_id);
create index if not exists items_sub_item_group_level_2_id_idx on public.items (sub_item_group_level_2_id);
create index if not exists items_sub_item_group_level_3_id_idx on public.items (sub_item_group_level_3_id);

with recursive lineage as (
  select item.id as item_id, selected.id, selected.father, selected.subgroup_level
  from public.items item
  join public.item_groups selected on selected.id = item.sub_item_group_id
  where item.sub_item_group_id is not null
  union all
  select lineage.item_id, parent.id, parent.father, parent.subgroup_level
  from lineage
  join public.item_groups parent on parent.id = lineage.father
  where lineage.father is not null
)
update public.items item
set sub_item_group_level_1_id = levels.level_1_id,
    sub_item_group_level_2_id = levels.level_2_id,
    sub_item_group_level_3_id = levels.level_3_id
from (
  select item_id,
    max(id) filter (where subgroup_level = 1) as level_1_id,
    max(id) filter (where subgroup_level = 2) as level_2_id,
    max(id) filter (where subgroup_level = 3) as level_3_id
  from lineage group by item_id
) levels
where item.id = levels.item_id
  and item.sub_item_group_level_1_id is null;

create or replace function public.validate_item_sub_item_group()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_root_id bigint;
  v_deepest_id bigint := coalesce(
    new.sub_item_group_level_3_id,
    new.sub_item_group_level_2_id,
    new.sub_item_group_level_1_id
  );
begin
  if new.sub_item_group_level_1_id is null then
    if new.sub_item_group_level_2_id is not null or new.sub_item_group_level_3_id is not null
       or new.sub_item_group_id is not null then
      raise exception 'Sub Group Level 1 is required before a deeper level.';
    end if;
    return new;
  end if;
  if new.sub_item_group_level_2_id is null and new.sub_item_group_level_3_id is not null then
    raise exception 'Sub Group Level 2 is required before Level 3.';
  end if;
  if new.sub_item_group_id is distinct from v_deepest_id then
    raise exception 'sub_item_group_id must match the deepest selected Sub Group level.';
  end if;

  select root.id into v_root_id
  from public.item_groups root
  where upper(btrim(root.code)) = upper(btrim(coalesce(new.item_group, '')))
    and root.father is null and btrim(coalesce(root.void::text, '0')) = '1';
  if v_root_id is null then raise exception 'The selected Item Group is not active.'; end if;

  if not exists (
    select 1 from public.item_groups level_1
    where level_1.id = new.sub_item_group_level_1_id
      and level_1.root_item_group_id = v_root_id and level_1.subgroup_level = 1
      and btrim(coalesce(level_1.void::text, '0')) = '1'
  ) then raise exception 'Sub Group Level 1 is not active under the selected Item Group.'; end if;

  if new.sub_item_group_level_2_id is not null and not exists (
    select 1 from public.item_groups level_2
    where level_2.id = new.sub_item_group_level_2_id
      and level_2.root_item_group_id = v_root_id and level_2.subgroup_level = 2
      and btrim(coalesce(level_2.void::text, '0')) = '1'
  ) then raise exception 'Sub Group Level 2 is not active under the selected Item Group.'; end if;

  if new.sub_item_group_level_3_id is not null and not exists (
    select 1 from public.item_groups level_3
    where level_3.id = new.sub_item_group_level_3_id
      and level_3.root_item_group_id = v_root_id and level_3.subgroup_level = 3
      and btrim(coalesce(level_3.void::text, '0')) = '1'
  ) then raise exception 'Sub Group Level 3 is not active under the selected Item Group.'; end if;
  return new;
end;
$$;

drop trigger if exists items_validate_sub_item_group on public.items;
create trigger items_validate_sub_item_group
before insert or update of item_group, sub_item_group_id,
  sub_item_group_level_1_id, sub_item_group_level_2_id, sub_item_group_level_3_id
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
      'subItemGroupId', new.sub_item_group_id,
      'subItemGroupPath', jsonb_build_array(
        new.sub_item_group_level_1_id,
        new.sub_item_group_level_2_id,
        new.sub_item_group_level_3_id
      )
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
      'inventory_uom', 'item_group', 'sub_item_group_id',
      'sub_item_group_level_1_id', 'sub_item_group_level_2_id',
      'sub_item_group_level_3_id', 'fms_group', 'group',
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
      'subItemGroupPath', jsonb_build_array(
        new.sub_item_group_level_1_id,
        new.sub_item_group_level_2_id,
        new.sub_item_group_level_3_id
      ),
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
  item_group, sub_item_group_id, sub_item_group_level_1_id,
  sub_item_group_level_2_id, sub_item_group_level_3_id, fms_group, "group", is_inventory_item,
  is_sales_item, is_purchase_item, is_delivery_item, manage_batch_numbers,
  manage_serial_numbers, batch_management_method, default_shelf_life_days,
  default_expiration_months, default_expiry_required, allow_negative_batch_stock,
  batch_number_series, min_on_hand, max_on_hand
on public.items
for each row
execute function public.enqueue_item_master_edited_event();

notify pgrst, 'reload schema';
