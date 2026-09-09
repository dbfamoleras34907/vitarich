-- Apply app/admin/notifications/notification_system.sql before this script.

create or replace function public.enqueue_item_group_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_auth_id uuid := auth.uid();
  v_fms_type text;
  v_changed_fields text[] := array[]::text[];
begin
  -- Authorized server mutations enqueue explicitly after commit because a
  -- service-role PostgREST call has no auth.uid(). Browser-authenticated legacy
  -- mutations continue to use this transactional trigger.
  if v_actor_auth_id is null then
    return new;
  end if;

  select case lower(btrim(coalesce(app_user.fms_type, '')))
    when 'broiler' then 'Broiler'
    when 'breeder' then 'Breeder'
    when 'hatchery' then 'Hatchery'
    else null
  end
  into v_fms_type
  from public.users app_user
  where app_user.auth_id = v_actor_auth_id
  limit 1;

  if tg_op = 'INSERT' then
    if new.code like 'PENDING-%' then
      return new;
    end if;

    insert into public.notification_outbox (
      module_key, event_key, entity_type, entity_id, document_no,
      fms_type, farm_id, recipient_farm_id, actor_auth_id, target_url,
      permission_group, permission_title, title, message, priority,
      metadata, dedupe_key, occurred_at
    ) values (
      'ITEM_GROUP', 'ITEM_GROUP_POSTED', 'item_groups', new.id::text, new.code,
      v_fms_type, null, null, v_actor_auth_id,
      '/a_dean/itemgroups/edit/' || new.id::text,
      'Menus', 'Item Group/view', 'Item Group posted',
      'Item Group {document_no} was posted by {initiator_name}.', 'normal',
      jsonb_build_object('code', new.code, 'name', new.name, 'father', new.father),
      'ITEM_GROUP_POSTED:' || new.id::text, now()
    )
    on conflict (dedupe_key) do nothing;

    return new;
  end if;

  if old.code like 'PENDING-%' and new.code not like 'PENDING-%' then
    insert into public.notification_outbox (
      module_key, event_key, entity_type, entity_id, document_no,
      fms_type, farm_id, recipient_farm_id, actor_auth_id, target_url,
      permission_group, permission_title, title, message, priority,
      metadata, dedupe_key, occurred_at
    ) values (
      'ITEM_GROUP', 'ITEM_GROUP_POSTED', 'item_groups', new.id::text, new.code,
      v_fms_type, null, null, v_actor_auth_id,
      '/a_dean/itemgroups/edit/' || new.id::text,
      'Menus', 'Item Group/view', 'Item Group posted',
      'Item Group {document_no} was posted by {initiator_name}.', 'normal',
      jsonb_build_object('code', new.code, 'name', new.name, 'father', new.father),
      'ITEM_GROUP_POSTED:' || new.id::text, now()
    )
    on conflict (dedupe_key) do nothing;

    return new;
  end if;

  if btrim(coalesce(old.void::text, '0')) = '1'
     and btrim(coalesce(new.void::text, '0')) <> '1' then
    insert into public.notification_outbox (
      module_key, event_key, entity_type, entity_id, document_no,
      fms_type, farm_id, recipient_farm_id, actor_auth_id, target_url,
      permission_group, permission_title, title, message, priority,
      metadata, dedupe_key, occurred_at
    ) values (
      'ITEM_GROUP', 'ITEM_GROUP_VOIDED', 'item_groups', new.id::text, new.code,
      v_fms_type, null, null, v_actor_auth_id, '/a_dean/itemgroups',
      'Menus', 'Item Group/view', 'Item Group voided',
      'Item Group {document_no} was voided by {initiator_name}.', 'normal',
      jsonb_build_object('code', new.code, 'name', new.name, 'father', new.father),
      'ITEM_GROUP_VOIDED:' || new.id::text, now()
    )
    on conflict (dedupe_key) do nothing;

    return new;
  end if;

  if new.code is distinct from old.code then
    v_changed_fields := array_append(v_changed_fields, 'code');
  end if;
  if new.name is distinct from old.name then
    v_changed_fields := array_append(v_changed_fields, 'name');
  end if;
  if new.remarks is distinct from old.remarks then
    v_changed_fields := array_append(v_changed_fields, 'remarks');
  end if;
  if new.father is distinct from old.father then
    v_changed_fields := array_append(v_changed_fields, 'father');
  end if;

  if cardinality(v_changed_fields) > 0
     and btrim(coalesce(new.void::text, '0')) = '1' then
    insert into public.notification_outbox (
      module_key, event_key, entity_type, entity_id, document_no,
      fms_type, farm_id, recipient_farm_id, actor_auth_id, target_url,
      permission_group, permission_title, title, message, priority,
      metadata, dedupe_key, occurred_at
    ) values (
      'ITEM_GROUP', 'ITEM_GROUP_EDITED', 'item_groups', new.id::text, new.code,
      v_fms_type, null, null, v_actor_auth_id,
      '/a_dean/itemgroups/edit/' || new.id::text,
      'Menus', 'Item Group/view', 'Item Group edited',
      'Item Group {document_no} was edited by {initiator_name}.', 'normal',
      jsonb_build_object(
        'code', new.code,
        'name', new.name,
        'father', new.father,
        'changedFields', to_jsonb(v_changed_fields)
      ),
      'ITEM_GROUP_EDITED:' || new.id::text || ':' || txid_current()::text,
      now()
    )
    on conflict (dedupe_key) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists item_groups_enqueue_event on public.item_groups;
create trigger item_groups_enqueue_event
after insert or update of code, name, remarks, father, void
on public.item_groups
for each row
execute function public.enqueue_item_group_event();
