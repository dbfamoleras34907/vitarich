-- Item Master database-to-database migration helpers.
--
-- Install this file in both databases. Export from the source:
--
--   select public.export_items_for_migration();
--
-- Copy the returned JSON value, then import it in the destination:
--
--   select public.import_items_for_migration(
--     $items$PASTE_EXPORTED_JSON_HERE$items$::jsonb
--   );
--
-- Existing destination rows are matched only by items.item_code and are left
-- completely unchanged. The destination generates its own item IDs so existing
-- identities cannot collide. Item Group foreign keys are transported by the
-- stable item_groups.code value and resolved to destination IDs during import.

create or replace function public.export_items_for_migration()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'item_code', item.item_code,
        'description', item.description,
        'barcode', item.barcode,
        'unit_measure', item.unit_measure,
        'created_at', item.created_at,
        'item_name', item.item_name,
        'void', item.void,
        'is_inventory_item', item.is_inventory_item,
        'is_sales_item', item.is_sales_item,
        'is_purchase_item', item.is_purchase_item,
        'on_hand', item.on_hand,
        'is_committed', item.is_committed,
        'on_order', item.on_order,
        'inventory_uom', item.inventory_uom,
        'item_group', item.item_group,
        'manage_batch_numbers', item.manage_batch_numbers,
        'manage_serial_numbers', item.manage_serial_numbers,
        'updated_at', item.updated_at,
        'group', item."group",
        'batch_management_method', item.batch_management_method,
        'default_shelf_life_days', item.default_shelf_life_days,
        'default_expiry_required', item.default_expiry_required,
        'allow_negative_batch_stock', item.allow_negative_batch_stock,
        'batch_number_series', item.batch_number_series,
        'created_by', item.created_by,
        'updated_by', item.updated_by,
        'is_delivery_item', item.is_delivery_item,
        'min_on_hand', item.min_on_hand,
        'max_on_hand', item.max_on_hand,
        'default_expiration_months', item.default_expiration_months,
        'fms_group', item.fms_group,
        'sub_item_group_code', subgroup.code::text,
        'sub_item_group_level_1_code', subgroup_level_1.code::text,
        'sub_item_group_level_2_code', subgroup_level_2.code::text,
        'sub_item_group_level_3_code', subgroup_level_3.code::text
      )
      order by item.item_code
    ),
    '[]'::jsonb
  )
  from public.items item
  left join public.item_groups subgroup
    on subgroup.id = item.sub_item_group_id
  left join public.item_groups subgroup_level_1
    on subgroup_level_1.id = item.sub_item_group_level_1_id
  left join public.item_groups subgroup_level_2
    on subgroup_level_2.id = item.sub_item_group_level_2_id
  left join public.item_groups subgroup_level_3
    on subgroup_level_3.id = item.sub_item_group_level_3_id;
$$;

create or replace function public.import_items_for_migration(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_input_count integer;
  v_inserted_count integer;
  v_problem record;
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Item migration payload must be a JSON array.';
  end if;

  v_input_count := jsonb_array_length(p_items);

  if v_input_count = 0 then
    return jsonb_build_object(
      'inputCount', 0,
      'insertedCount', 0,
      'skippedCount', 0
    );
  end if;

  -- Serialize Item Master migrations so concurrent runs produce predictable
  -- inserted/skipped counts while the unique constraint remains authoritative.
  perform pg_advisory_xact_lock(
    hashtextextended('item-master-database-migration', 0)
  );

  -- Fail before inserting anything when a new row has no usable natural key.
  select payload.ordinality, payload.value ->> 'item_code' as item_code
  into v_problem
  from jsonb_array_elements(p_items) with ordinality payload(value, ordinality)
  where nullif(btrim(payload.value ->> 'item_code'), '') is null
  order by payload.ordinality
  limit 1;

  if found then
    raise exception 'Migration row % has no item_code.', v_problem.ordinality;
  end if;

  -- Validate only rows that will be inserted. A row already present in the
  -- destination is intentionally skipped without inspecting or changing it.
  with incoming as (
    select payload.ordinality, payload.value
    from jsonb_array_elements(p_items) with ordinality payload(value, ordinality)
    where not exists (
      select 1
      from public.items existing_item
      where existing_item.item_code = payload.value ->> 'item_code'
    )
  ), group_references as (
    select
      incoming.ordinality,
      incoming.value ->> 'item_code' as item_code,
      reference.field_name,
      nullif(btrim(incoming.value ->> reference.field_name), '') as group_code
    from incoming
    cross join (values
      ('sub_item_group_code'),
      ('sub_item_group_level_1_code'),
      ('sub_item_group_level_2_code'),
      ('sub_item_group_level_3_code')
    ) reference(field_name)
  )
  select
    group_references.ordinality,
    group_references.item_code,
    group_references.field_name,
    group_references.group_code,
    count(destination_group.id) as match_count
  into v_problem
  from group_references
  left join public.item_groups destination_group
    on destination_group.code::text = group_references.group_code
  where group_references.group_code is not null
  group by
    group_references.ordinality,
    group_references.item_code,
    group_references.field_name,
    group_references.group_code
  having count(destination_group.id) <> 1
  order by group_references.ordinality, group_references.field_name
  limit 1;

  if found then
    raise exception
      'Item % cannot resolve % = %: destination match count is %.',
      v_problem.item_code,
      v_problem.field_name,
      v_problem.group_code,
      v_problem.match_count;
  end if;

  insert into public.items (
    item_code,
    description,
    barcode,
    unit_measure,
    created_at,
    item_name,
    void,
    is_inventory_item,
    is_sales_item,
    is_purchase_item,
    on_hand,
    is_committed,
    on_order,
    inventory_uom,
    item_group,
    manage_batch_numbers,
    manage_serial_numbers,
    updated_at,
    "group",
    batch_management_method,
    default_shelf_life_days,
    default_expiry_required,
    allow_negative_batch_stock,
    batch_number_series,
    created_by,
    updated_by,
    is_delivery_item,
    min_on_hand,
    max_on_hand,
    default_expiration_months,
    fms_group,
    sub_item_group_id,
    sub_item_group_level_1_id,
    sub_item_group_level_2_id,
    sub_item_group_level_3_id
  )
  select
    migration_item.item_code,
    migration_item.description,
    migration_item.barcode,
    coalesce(migration_item.unit_measure, 'pcs'),
    coalesce(migration_item.created_at, now()),
    migration_item.item_name,
    coalesce(migration_item.void, 1),
    coalesce(migration_item.is_inventory_item, true),
    coalesce(migration_item.is_sales_item, true),
    coalesce(migration_item.is_purchase_item, true),
    coalesce(migration_item.on_hand, 0),
    coalesce(migration_item.is_committed, 0),
    coalesce(migration_item.on_order, 0),
    migration_item.inventory_uom,
    migration_item.item_group,
    coalesce(migration_item.manage_batch_numbers, false),
    coalesce(migration_item.manage_serial_numbers, false),
    coalesce(migration_item.updated_at, now()),
    migration_item."group",
    coalesce(migration_item.batch_management_method, 'NONE'),
    migration_item.default_shelf_life_days,
    coalesce(migration_item.default_expiry_required, false),
    coalesce(migration_item.allow_negative_batch_stock, false),
    migration_item.batch_number_series,
    migration_item.created_by,
    migration_item.updated_by,
    coalesce(migration_item.is_delivery_item, true),
    migration_item.min_on_hand,
    migration_item.max_on_hand,
    migration_item.default_expiration_months,
    migration_item.fms_group,
    subgroup.id,
    subgroup_level_1.id,
    subgroup_level_2.id,
    subgroup_level_3.id
  from jsonb_to_recordset(p_items) as migration_item (
    item_code text,
    description text,
    barcode text,
    unit_measure text,
    created_at timestamptz,
    item_name text,
    void smallint,
    is_inventory_item boolean,
    is_sales_item boolean,
    is_purchase_item boolean,
    on_hand numeric(19, 6),
    is_committed numeric(19, 6),
    on_order numeric(19, 6),
    inventory_uom text,
    item_group text,
    manage_batch_numbers boolean,
    manage_serial_numbers boolean,
    updated_at timestamptz,
    "group" text,
    batch_management_method text,
    default_shelf_life_days integer,
    default_expiry_required boolean,
    allow_negative_batch_stock boolean,
    batch_number_series text,
    created_by uuid,
    updated_by uuid,
    is_delivery_item boolean,
    min_on_hand numeric(19, 6),
    max_on_hand numeric(19, 6),
    default_expiration_months integer,
    fms_group text,
    sub_item_group_code text,
    sub_item_group_level_1_code text,
    sub_item_group_level_2_code text,
    sub_item_group_level_3_code text
  )
  left join public.item_groups subgroup
    on subgroup.code::text = nullif(btrim(migration_item.sub_item_group_code), '')
  left join public.item_groups subgroup_level_1
    on subgroup_level_1.code::text = nullif(btrim(migration_item.sub_item_group_level_1_code), '')
  left join public.item_groups subgroup_level_2
    on subgroup_level_2.code::text = nullif(btrim(migration_item.sub_item_group_level_2_code), '')
  left join public.item_groups subgroup_level_3
    on subgroup_level_3.code::text = nullif(btrim(migration_item.sub_item_group_level_3_code), '')
  on conflict (item_code) do nothing;

  get diagnostics v_inserted_count = row_count;

  return jsonb_build_object(
    'inputCount', v_input_count,
    'insertedCount', v_inserted_count,
    'skippedCount', v_input_count - v_inserted_count
  );
end;
$$;

revoke all on function public.export_items_for_migration()
from public, anon, authenticated;
revoke all on function public.import_items_for_migration(jsonb)
from public, anon, authenticated;

grant execute on function public.export_items_for_migration()
to service_role;
grant execute on function public.import_items_for_migration(jsonb)
to service_role;

notify pgrst, 'reload schema';
