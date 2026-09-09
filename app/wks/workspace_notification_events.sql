-- Apply app/admin/notifications/notification_system.sql before this script.
-- These events are cross-FMS workspace events, so farm routing is explicitly none.

create or replace function public.enqueue_workspace_entity_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_auth_id uuid := auth.uid();
  v_fms_type text;
  v_old jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_new jsonb := to_jsonb(new);
  v_module_key text;
  v_event_prefix text;
  v_permission_title text;
  v_base_url text;
  v_entity_id text := v_new ->> 'id';
  v_document_no text;
  v_event_key text;
  v_action text;
  v_changed_fields text[] := array[]::text[];
  v_field text;
begin
  if tg_table_name = 'projects' then
    v_module_key := 'WORKSPACE_PROJECT';
    v_event_prefix := 'WORKSPACE_PROJECT';
    v_permission_title := 'Projects/view';
    v_base_url := '/wks/projects';
    v_document_no := coalesce(v_new ->> 'project_name', v_new ->> 'name', v_entity_id);
  elsif tg_table_name = 'tasks' then
    v_module_key := 'WORKSPACE_TASK';
    v_event_prefix := 'WORKSPACE_TASK';
    v_permission_title := 'Task/view';
    v_base_url := '/wks/tasks';
    v_document_no := coalesce(v_new ->> 'subject', v_entity_id);
  else
    raise exception 'Unsupported workspace event table: %', tg_table_name;
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
    v_event_key := v_event_prefix || '_POSTED';
    v_action := 'posted';
  elsif btrim(coalesce(v_old ->> 'void', '1')) = '1'
        and btrim(coalesce(v_new ->> 'void', '1')) <> '1' then
    v_event_key := v_event_prefix || '_VOIDED';
    v_action := 'voided';
  else
    for v_field in select jsonb_object_keys(v_new)
    loop
      if v_field not in ('updated_at', 'updated_by')
         and (v_new -> v_field) is distinct from (v_old -> v_field) then
        v_changed_fields := array_append(v_changed_fields, v_field);
      end if;
    end loop;

    if cardinality(v_changed_fields) = 0 then
      return new;
    end if;

    v_event_key := v_event_prefix || '_EDITED';
    v_action := 'edited';
  end if;

  insert into public.notification_outbox (
    module_key, event_key, entity_type, entity_id, document_no,
    fms_type, farm_id, recipient_farm_id, actor_auth_id, target_url,
    permission_group, permission_title, title, message, priority,
    metadata, dedupe_key, occurred_at
  ) values (
    v_module_key, v_event_key, tg_table_name, v_entity_id, v_document_no,
    v_fms_type, null, null, v_actor_auth_id, v_base_url || '/' || v_entity_id,
    'Projects', v_permission_title,
    case when tg_table_name = 'projects' then 'Project ' else 'Task ' end || v_action,
    case when tg_table_name = 'projects' then 'Project ' else 'Task ' end ||
      '{document_no} was ' || v_action || ' by {initiator_name}.',
    'normal',
    jsonb_build_object('changedFields', to_jsonb(v_changed_fields)),
    v_event_key || ':' || v_entity_id || ':' ||
      case when tg_op = 'INSERT' or v_action = 'voided' then 'once' else txid_current()::text end,
    now()
  )
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

drop trigger if exists projects_enqueue_workspace_event on public.projects;
create trigger projects_enqueue_workspace_event
after insert or update on public.projects
for each row execute function public.enqueue_workspace_entity_event();

drop trigger if exists tasks_enqueue_workspace_event on public.tasks;
create trigger tasks_enqueue_workspace_event
after insert or update on public.tasks
for each row execute function public.enqueue_workspace_entity_event();

create or replace function public.enqueue_workspace_timesheet_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_auth_id uuid := auth.uid();
  v_fms_type text;
  v_old jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_new jsonb := to_jsonb(new);
  v_entity_id text := v_new ->> 'id';
  v_event_key text;
  v_action text;
begin
  if lower(coalesce(v_new ->> 'status', '')) = 'submitted'
     and lower(coalesce(v_old ->> 'status', '')) <> 'submitted' then
    v_event_key := 'WORKSPACE_TIMESHEET_POSTED';
    v_action := 'submitted';
  elsif tg_op = 'UPDATE' and v_new is distinct from v_old then
    v_event_key := 'WORKSPACE_TIMESHEET_EDITED';
    v_action := 'edited';
  else
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

  insert into public.notification_outbox (
    module_key, event_key, entity_type, entity_id, document_no,
    fms_type, farm_id, recipient_farm_id, actor_auth_id, target_url,
    permission_group, permission_title, title, message, priority,
    metadata, dedupe_key, occurred_at
  ) values (
    'WORKSPACE_TIMESHEET', v_event_key, tg_table_name, v_entity_id, v_entity_id,
    v_fms_type, null, null, v_actor_auth_id, '/wks/timelines/' || v_entity_id,
    'Projects', 'Timesheet/view', 'Timesheet ' || v_action,
    'Timesheet {document_no} was ' || v_action || ' by {initiator_name}.', 'normal',
    jsonb_build_object('status', v_new ->> 'status'),
    v_event_key || ':' || v_entity_id || ':' ||
      case when v_event_key = 'WORKSPACE_TIMESHEET_POSTED' then 'once' else txid_current()::text end,
    now()
  )
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.timesheets') is null then
    raise exception 'public.timesheets was not found; verify the base table behind vw_timesheets before applying workspace notification events.';
  end if;

  execute 'drop trigger if exists timesheets_enqueue_workspace_event on public.timesheets';
  execute 'create trigger timesheets_enqueue_workspace_event after insert or update on public.timesheets for each row execute function public.enqueue_workspace_timesheet_event()';
end;
$$;
