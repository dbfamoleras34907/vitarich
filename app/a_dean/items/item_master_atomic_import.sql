-- Atomic Item Master Excel import.
-- Every row is inserted in this single function transaction. Any exception
-- aborts the RPC and rolls back all items and notification outbox rows.

drop function if exists public.import_item_master_items(jsonb, uuid);
drop function if exists public.import_item_master_items(jsonb, uuid, boolean);

create function public.import_item_master_items(
  p_rows jsonb,
  p_actor_auth_id uuid,
  p_skip_existing boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry jsonb;
  v_payload jsonb;
  v_row_number integer;
  v_prefix text;
  v_next_sequence bigint;
  v_item_code text;
  v_imported_count integer := 0;
  v_skipped_count integer := 0;
begin
  if p_actor_auth_id is null then
    raise exception 'The import actor is required.';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'The import does not contain any item rows.';
  end if;
  if jsonb_array_length(p_rows) > 5000 then
    raise exception 'A single Item Master import is limited to 5,000 rows.';
  end if;

  -- Preserve the authenticated user for the existing Item Master notification
  -- trigger even though this RPC is invoked by the authorized server client.
  perform set_config('request.jwt.claim.sub', p_actor_auth_id::text, true);

  -- Acquire locks in a stable order before allocating codes. This prevents two
  -- imports using the same Item Group prefix from generating duplicate codes.
  for v_prefix in
    select distinct upper(regexp_replace(
      coalesce(entry.value -> 'payload' ->> 'item_group', entry.value -> 'payload' ->> 'group', ''),
      '[^A-Za-z0-9]', '', 'g'
    ))
    from jsonb_array_elements(p_rows) entry(value)
    order by 1
  loop
    if v_prefix = '' then
      raise exception 'Item group is required before item code can be generated.';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('item-master-code:' || v_prefix, 0));
  end loop;

  for v_entry in select value from jsonb_array_elements(p_rows)
  loop
    v_payload := coalesce(v_entry -> 'payload', '{}'::jsonb);
    v_row_number := coalesce(nullif(v_entry ->> 'rowNumber', '')::integer, v_imported_count + 2);
    v_prefix := upper(regexp_replace(
      coalesce(v_payload ->> 'item_group', v_payload ->> 'group', ''),
      '[^A-Za-z0-9]', '', 'g'
    ));

    begin
      if v_prefix = '' then
        raise exception 'Item group is required before item code can be generated.';
      end if;

      if p_skip_existing and exists (
        select 1
        from public.items existing_item
        where lower(btrim(coalesce(existing_item.item_name, ''))) =
              lower(btrim(coalesce(v_payload ->> 'item_name', '')))
          and upper(btrim(coalesce(existing_item.item_group, ''))) =
              upper(btrim(coalesce(v_payload ->> 'item_group', '')))
      ) then
        v_skipped_count := v_skipped_count + 1;
        continue;
      end if;

      select coalesce(max(right(item.item_code, 5)::bigint), 0) + 1
      into v_next_sequence
      from public.items item
      where item.item_code ~ ('^' || v_prefix || '[0-9]{5}$');

      if v_next_sequence > 99999 then
        raise exception 'The item code sequence for Item Group % is exhausted.', v_prefix;
      end if;
      v_item_code := v_prefix || lpad(v_next_sequence::text, 5, '0');

      insert into public.items (
        item_code, item_name, description, barcode, unit_measure, inventory_uom,
        item_group, sub_item_group_id, sub_item_group_level_1_id,
        sub_item_group_level_2_id, sub_item_group_level_3_id, fms_group, "group",
        is_inventory_item, is_sales_item, is_purchase_item, is_delivery_item,
        manage_batch_numbers, manage_serial_numbers, batch_management_method,
        default_shelf_life_days, default_expiration_months,
        default_expiry_required, allow_negative_batch_stock, batch_number_series,
        min_on_hand, max_on_hand, void
      ) values (
        v_item_code,
        nullif(btrim(v_payload ->> 'item_name'), ''),
        nullif(btrim(v_payload ->> 'description'), ''),
        nullif(btrim(v_payload ->> 'barcode'), ''),
        coalesce(nullif(btrim(v_payload ->> 'unit_measure'), ''), 'pcs'),
        coalesce(
          nullif(btrim(v_payload ->> 'inventory_uom'), ''),
          nullif(btrim(v_payload ->> 'unit_measure'), ''),
          'pcs'
        ),
        nullif(btrim(v_payload ->> 'item_group'), ''),
        nullif(v_payload ->> 'sub_item_group_id', '')::bigint,
        nullif(v_payload ->> 'sub_item_group_level_1_id', '')::bigint,
        nullif(v_payload ->> 'sub_item_group_level_2_id', '')::bigint,
        nullif(v_payload ->> 'sub_item_group_level_3_id', '')::bigint,
        nullif(btrim(v_payload ->> 'fms_group'), ''),
        coalesce(
          nullif(btrim(v_payload ->> 'group'), ''),
          nullif(btrim(v_payload ->> 'item_group'), '')
        ),
        coalesce((v_payload ->> 'is_inventory_item')::boolean, true),
        coalesce((v_payload ->> 'is_sales_item')::boolean, true),
        coalesce((v_payload ->> 'is_purchase_item')::boolean, true),
        coalesce((v_payload ->> 'is_delivery_item')::boolean, true),
        coalesce((v_payload ->> 'manage_batch_numbers')::boolean, false),
        coalesce((v_payload ->> 'manage_serial_numbers')::boolean, false),
        coalesce(nullif(btrim(v_payload ->> 'batch_management_method'), ''), 'NONE'),
        nullif(v_payload ->> 'default_shelf_life_days', '')::integer,
        nullif(v_payload ->> 'default_expiration_months', '')::integer,
        coalesce((v_payload ->> 'default_expiry_required')::boolean, false),
        coalesce((v_payload ->> 'allow_negative_batch_stock')::boolean, false),
        nullif(btrim(v_payload ->> 'batch_number_series'), ''),
        nullif(v_payload ->> 'min_on_hand', '')::numeric,
        nullif(v_payload ->> 'max_on_hand', '')::numeric,
        1
      );

      v_imported_count := v_imported_count + 1;
    exception
      when others then
        raise exception using
          errcode = sqlstate,
          message = format('Row %s: %s', v_row_number, sqlerrm);
    end;
  end loop;

  return jsonb_build_object(
    'importedCount', v_imported_count,
    'skippedCount', v_skipped_count
  );
end;
$$;

revoke all on function public.import_item_master_items(jsonb, uuid, boolean)
from public, anon, authenticated;
grant execute on function public.import_item_master_items(jsonb, uuid, boolean)
to service_role;

notify pgrst, 'reload schema';
