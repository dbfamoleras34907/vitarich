-- Apply notification_system.sql and allow_harvest_emptied_cleanup.sql first.
begin;
alter table public.br_cleanup add column if not exists notification_revision bigint not null default 0;
alter table public.br_cleanup add column if not exists notification_fingerprint text;

create or replace function public.save_br_cleanup_transaction(p_document jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_document_id bigint;
  v_existing_status text;
  v_target_status text := coalesce(nullif(trim(p_document->>'status'), ''), 'Draft');
  v_farm_id bigint := nullif(p_document->>'farmId', '')::bigint;
  v_farm_code text;
  v_farm_name text;
  v_line jsonb;
  v_line_id bigint;
  v_line_no integer := 0;
  v_header jsonb;
  v_lines jsonb;
  v_request_fingerprint text;
  v_existing public.br_cleanup%rowtype;
begin
  if v_actor is null then
    raise exception 'An authenticated user is required to save Clean Up.';
  end if;

  if v_target_status not in ('Draft', 'Posted') then
    raise exception 'Clean Up can only be saved as Draft or Posted.';
  end if;

  select farm.code, farm.name
  into v_farm_code, v_farm_name
  from public.farms farm
  where farm.id = v_farm_id;

  if not found then
    raise exception 'Clean Up requires a valid farm.';
  end if;

  if jsonb_typeof(p_document->'lines') is distinct from 'array'
     or jsonb_array_length(p_document->'lines') = 0 then
    raise exception 'Clean Up requires at least one line.';
  end if;

  -- Serialize by document number to recover a lost create response safely.
  perform pg_advisory_xact_lock(hashtextextended('BR-CU-SAVE:' || (p_document->>'giNo'), 0));
  v_request_fingerprint := md5(jsonb_build_object(
    'document', p_document - array['id', 'lines', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'farmCode', 'farmName'],
    'lines', (select jsonb_agg(value - array['id', 'onHandQty', 'requestedAltQty', 'allocationGroupKey'] order by ord)
      from jsonb_array_elements(p_document->'lines') with ordinality as input(value, ord))
  )::text);
  select * into v_existing from public.br_cleanup
    where (nullif(p_document->>'id', '') is not null and id = (p_document->>'id')::bigint)
       or (nullif(p_document->>'id', '') is null and gi_no = trim(p_document->>'giNo'))
    for update;
  if found then
    v_document_id := v_existing.id;
    v_existing_status := v_existing.status;
    if nullif(p_document->>'id', '') is null and v_existing.created_by is distinct from v_actor then
      raise exception 'Clean Up belongs to another user and cannot be overwritten.';
    end if;
    if v_existing.notification_fingerprint = v_request_fingerprint then
      return jsonb_build_object('header', to_jsonb(v_existing), 'lines',
        (select coalesce(jsonb_agg(to_jsonb(line) order by line.line_no), '[]'::jsonb)
         from public.br_cleanup_lines line where line.br_cleanup_id = v_document_id and line.void = '1'));
    end if;
    if v_existing_status <> 'Draft' then
      raise exception 'Only draft Clean Up documents can be edited or posted.';
    end if;
    update public.br_cleanup
    set
      gi_no = trim(p_document->>'giNo'),
      issue_date = (p_document->>'issueDate')::date,
      farm_id = v_farm_id,
      farm_code = nullif(trim(v_farm_code), ''),
      farm_name = nullif(trim(v_farm_name), ''),
      from_warehouse_id = nullif(p_document->>'fromWarehouseId', '')::bigint,
      from_warehouse_code = nullif(trim(p_document->>'fromWarehouseCode'), ''),
      from_warehouse_name = nullif(trim(p_document->>'fromWarehouseName'), ''),
      triggered_by = 'BR-CU',
      remarks = nullif(trim(p_document->>'remarks'), ''),
      status = 'Draft',
      updated_by = v_actor
    where id = v_document_id;
  else
    if nullif(p_document->>'id', '') is not null then raise exception 'Clean Up document was not found.'; end if;
    insert into public.br_cleanup (
      gi_no,
      issue_date,
      farm_id,
      farm_code,
      farm_name,
      from_warehouse_id,
      from_warehouse_code,
      from_warehouse_name,
      triggered_by,
      remarks,
      status,
      created_by
    ) values (
      trim(p_document->>'giNo'),
      (p_document->>'issueDate')::date,
      v_farm_id,
      nullif(trim(v_farm_code), ''),
      nullif(trim(v_farm_name), ''),
      nullif(p_document->>'fromWarehouseId', '')::bigint,
      nullif(trim(p_document->>'fromWarehouseCode'), ''),
      nullif(trim(p_document->>'fromWarehouseName'), ''),
      'BR-CU',
      nullif(trim(p_document->>'remarks'), ''),
      'Draft',
      v_actor
    )
    returning id into v_document_id;
  end if;

  update public.br_cleanup_lines
  set
    line_no = -id,
    void = '0',
    updated_by = v_actor
  where br_cleanup_id = v_document_id
    and void = '1';

  for v_line in select value from jsonb_array_elements(p_document->'lines')
  loop
    v_line_no := v_line_no + 1;
    v_line_id := case
      when coalesce(v_line->>'id', '') ~ '^[0-9]+$' then (v_line->>'id')::bigint
      else null
    end;

    if v_line_id is not null and exists (
      select 1
      from public.br_cleanup_lines existing_line
      where existing_line.id = v_line_id
        and existing_line.br_cleanup_id = v_document_id
    ) then
      update public.br_cleanup_lines
      set
        line_no = v_line_no,
        item_id = nullif(v_line->>'itemId', '')::bigint,
        item_code = trim(v_line->>'itemCode'),
        description = nullif(trim(v_line->>'description'), ''),
        remarks = nullif(trim(v_line->>'lineRemarks'), ''),
        batch_total_qty = coalesce((v_line->>'batchTotalQty')::numeric, 0),
        variance_qty = coalesce((v_line->>'varianceQty')::numeric, 0),
        batch_rule_id = nullif(v_line->>'batchRuleId', '')::bigint,
        batch_number = nullif(trim(v_line->>'batchNumber'), ''),
        manufacturing_date = nullif(v_line->>'manufacturingDate', '')::date,
        expiry_date = nullif(v_line->>'expiryDate', '')::date,
        alt_qty = (v_line->>'altQty')::numeric,
        alt_uom = trim(v_line->>'altUom'),
        base_qty = (v_line->>'baseQty')::numeric,
        base_uom = trim(v_line->>'baseUom'),
        from_warehouse_id = nullif(v_line->>'fromWarehouseId', '')::bigint,
        from_warehouse_code = nullif(trim(v_line->>'fromWarehouseCode'), ''),
        from_warehouse_name = nullif(trim(v_line->>'fromWarehouseName'), ''),
        void = '1',
        updated_by = v_actor
      where id = v_line_id;
    else
      insert into public.br_cleanup_lines (
        br_cleanup_id,
        line_no,
        item_id,
        item_code,
        description,
        remarks,
        batch_total_qty,
        variance_qty,
        batch_rule_id,
        batch_number,
        manufacturing_date,
        expiry_date,
        alt_qty,
        alt_uom,
        base_qty,
        base_uom,
        from_warehouse_id,
        from_warehouse_code,
        from_warehouse_name,
        void,
        created_by
      ) values (
        v_document_id,
        v_line_no,
        nullif(v_line->>'itemId', '')::bigint,
        trim(v_line->>'itemCode'),
        nullif(trim(v_line->>'description'), ''),
        nullif(trim(v_line->>'lineRemarks'), ''),
        coalesce((v_line->>'batchTotalQty')::numeric, 0),
        coalesce((v_line->>'varianceQty')::numeric, 0),
        nullif(v_line->>'batchRuleId', '')::bigint,
        nullif(trim(v_line->>'batchNumber'), ''),
        nullif(v_line->>'manufacturingDate', '')::date,
        nullif(v_line->>'expiryDate', '')::date,
        (v_line->>'altQty')::numeric,
        trim(v_line->>'altUom'),
        (v_line->>'baseQty')::numeric,
        trim(v_line->>'baseUom'),
        nullif(v_line->>'fromWarehouseId', '')::bigint,
        nullif(trim(v_line->>'fromWarehouseCode'), ''),
        nullif(trim(v_line->>'fromWarehouseName'), ''),
        '1',
        v_actor
      );
    end if;
  end loop;

  if v_target_status = 'Posted' then
    perform pg_advisory_xact_lock(hashtextextended('BR_DELIVERY_INVENTORY_POST', 0));

    update public.br_cleanup
    set status = 'Posted', updated_by = v_actor
    where id = v_document_id;
  end if;

  select to_jsonb(delivery)
  into v_header
  from public.br_cleanup delivery
  where delivery.id = v_document_id;

  select coalesce(jsonb_agg(to_jsonb(line) order by line.line_no), '[]'::jsonb)
  into v_lines
  from public.br_cleanup_lines line
  where line.br_cleanup_id = v_document_id
    and line.void = '1';

  -- One revision per completed action; the outbox write rolls back with the save.
  update public.br_cleanup
  set notification_fingerprint = v_request_fingerprint,
      notification_revision = notification_revision +
        case when v_target_status = 'Posted' or v_existing_status is not null then 1 else 0 end
  where id = v_document_id;

  return jsonb_build_object('header', v_header, 'lines', v_lines);
end;
$$;

revoke all on function public.save_br_cleanup_transaction(jsonb) from public;
revoke all on function public.save_br_cleanup_transaction(jsonb) from anon;
grant execute on function public.save_br_cleanup_transaction(jsonb) to authenticated;

-- Only the outbox trigger elevates privileges; the business RPC remains SECURITY INVOKER.
create or replace function public.enqueue_br_cleanup_event()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_event_key text := case when new.status = 'Posted' then 'BR_CLEANUP_POSTED' else 'BR_CLEANUP_EDITED' end;
begin
  insert into public.notification_outbox (
    module_key, event_key, entity_type, entity_id, document_no, fms_type,
    farm_id, recipient_farm_id, actor_auth_id, target_url,
    permission_group, permission_title, title, message, priority,
    metadata, dedupe_key, occurred_at
  ) values (
    'BR_CLEANUP', v_event_key, 'br_cleanup', new.id::text, new.gi_no, 'Broiler',
    new.farm_id, new.farm_id, auth.uid(), '/brd/cu/post?id=' || new.id,
    'Menus', 'Clean up/view',
    case when new.status = 'Posted' then 'Clean Up posted' else 'Clean Up edited' end,
    'Clean Up {document_no} was saved by {initiator_name}.', 'normal',
    jsonb_build_object('revision', new.notification_revision),
    v_event_key || ':' || new.id || ':' || new.notification_revision, now()
  ) on conflict (dedupe_key) do nothing;
  return new;
end;
$$;
revoke all on function public.enqueue_br_cleanup_event() from public, anon, authenticated;
drop trigger if exists br_cleanup_enqueue_event on public.br_cleanup;
create trigger br_cleanup_enqueue_event after update of notification_revision on public.br_cleanup
for each row when (new.notification_revision > old.notification_revision)
execute function public.enqueue_br_cleanup_event();

-- Add the source verifier to the installed centralized dispatcher.
do $patch$
declare v_definition text;
begin
  select pg_get_functiondef('public.process_notification_outbox(integer)'::regprocedure) into v_definition;
  if position('BR_CLEANUP' in v_definition) = 0 then
    if position('      elsif v_event.module_key = ''BR_DELIVERY''' in v_definition) = 0 then
      raise exception 'Apply the current centralized notification_system.sql first.';
    end if;
    v_definition := replace(v_definition, '      elsif v_event.module_key = ''BR_DELIVERY''',
      $branch$      elsif v_event.module_key = 'BR_CLEANUP'
            and v_event.event_key in ('BR_CLEANUP_POSTED', 'BR_CLEANUP_EDITED') then
        select exists (
          select 1 from public.br_cleanup delivery
          join public.farms farm on farm.id = delivery.farm_id
          where delivery.id::text = v_event.entity_id
            and delivery.farm_id = v_event.farm_id
            and delivery.farm_id = v_event.recipient_farm_id
            and v_event.entity_type = 'br_cleanup'
            and v_event.fms_type = 'Broiler'
            and upper(btrim(farm.farm_type)) in ('BR', 'BROILER')
            and (v_event.event_key <> 'BR_CLEANUP_POSTED' or delivery.status = 'Posted')
        ) into v_source_valid;
        if not coalesce(v_source_valid, false) then
          update public.notification_outbox
          set status = 'invalid', processed_at = now(), processing_started_at = null,
              last_error = 'Clean Up event does not match its persisted farm.'
          where id = v_event.id;
          continue;
        end if;
      elsif v_event.module_key = 'BR_DELIVERY'$branch$);
    execute v_definition;
  end if;
end;
$patch$;

notify pgrst, 'reload schema';

commit;
