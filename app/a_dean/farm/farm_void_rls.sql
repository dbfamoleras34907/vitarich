-- Apply app/admin/notifications/notification_system.sql before this script.
-- The farms table uses the legacy convention void = '1' for active rows.

alter table public.farms
  alter column void set default '1';

create or replace function public.current_user_has_farm_permission(p_link text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users app_user
    where app_user.auth_id = auth.uid()
      and coalesce(btrim(app_user.isactive::text), '1') = '1'
      and (
        coalesce(app_user.user_type, 3) = 1
        or exists (
          select 1
          from public.user_permissions permission
          where permission.user_id = auth.uid()
            and permission.ilink = p_link
            and permission.is_visible
        )
      )
  );
$$;

revoke all on function public.current_user_has_farm_permission(text) from public;
grant execute on function public.current_user_has_farm_permission(text) to authenticated;

alter table public.farms enable row level security;

-- Restrictive policies ensure that a broader legacy policy cannot expose a
-- void farm or allow a browser update to perform the active-to-void transition.
drop policy if exists farms_active_select_restrictive on public.farms;
create policy farms_active_select_restrictive
  on public.farms
  as restrictive
  for select
  to authenticated
  using (coalesce(btrim(void::text), '0') = '1');

drop policy if exists farms_active_update_restrictive on public.farms;
create policy farms_active_update_restrictive
  on public.farms
  as restrictive
  for update
  to authenticated
  using (coalesce(btrim(void::text), '0') = '1')
  with check (coalesce(btrim(void::text), '0') = '1');

drop policy if exists farms_authenticated_select_active on public.farms;
create policy farms_authenticated_select_active
  on public.farms
  for select
  to authenticated
  using (true);

drop policy if exists farms_setup_insert on public.farms;
create policy farms_setup_insert
  on public.farms
  for insert
  to authenticated
  with check (
    coalesce(btrim(void::text), '0') = '1'
    and public.current_user_has_farm_permission('/a_dean/farm/setup/insert')
  );

drop policy if exists farms_setup_update on public.farms;
create policy farms_setup_update
  on public.farms
  for update
  to authenticated
  using (
    public.current_user_has_farm_permission('/a_dean/farm')
    or public.current_user_has_farm_permission('/a_dean/farm/edit')
    or public.current_user_has_farm_permission('/a_dean/farm/setup/edit')
    or public.current_user_has_farm_permission('/a_dean/farm/setup/insert')
    or public.current_user_has_farm_permission('/a_dean/farm/setup/approval')
  )
  with check (
    public.current_user_has_farm_permission('/a_dean/farm')
    or public.current_user_has_farm_permission('/a_dean/farm/edit')
    or public.current_user_has_farm_permission('/a_dean/farm/setup/edit')
    or public.current_user_has_farm_permission('/a_dean/farm/setup/insert')
    or public.current_user_has_farm_permission('/a_dean/farm/setup/approval')
  );

grant select, insert, update on public.farms to authenticated;

create or replace function public.enqueue_farm_event()
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
  -- Service-role mutations provide their actor explicitly in the authoritative
  -- RPC. Browser-authenticated wizard mutations are captured transactionally here.
  if v_actor_auth_id is null then
    return new;
  end if;

  v_fms_type := case upper(btrim(coalesce(new.farm_type, '')))
    when 'BR' then 'Broiler'
    when 'BROILER' then 'Broiler'
    when 'BE' then 'Breeder'
    when 'BREEDER' then 'Breeder'
    when 'HA' then 'Hatchery'
    when 'HATCHERY' then 'Hatchery'
    else null
  end;

  if tg_op = 'INSERT' then
    if coalesce(new.approval_status, 'approved') <> 'approved' then
      return new;
    end if;

    insert into public.notification_outbox (
      module_key, event_key, entity_type, entity_id, document_no,
      fms_type, farm_id, recipient_farm_id, actor_auth_id, target_url,
      permission_group, permission_title, title, message, priority,
      metadata, dedupe_key, occurred_at
    ) values (
      'FARM', 'FARM_POSTED', 'farms', new.id::text, new.code,
      v_fms_type, new.id, new.id, v_actor_auth_id,
      '/a_dean/farm/' || new.id::text || '/edit',
      'Modules', 'Farm Management', 'Farm posted',
      'Farm {document_no} was posted by {initiator_name}.', 'normal',
      jsonb_build_object('code', new.code, 'name', new.name, 'farmType', new.farm_type),
      'FARM_POSTED:' || new.id::text, now()
    ) on conflict (dedupe_key) do nothing;

    return new;
  end if;

  if coalesce(btrim(old.void::text), '0') = '1'
     and coalesce(btrim(new.void::text), '0') <> '1' then
    insert into public.notification_outbox (
      module_key, event_key, entity_type, entity_id, document_no,
      fms_type, farm_id, recipient_farm_id, actor_auth_id, target_url,
      permission_group, permission_title, title, message, priority,
      metadata, dedupe_key, occurred_at
    ) values (
      'FARM', 'FARM_VOIDED', 'farms', new.id::text, new.code,
      v_fms_type, new.id, new.id, v_actor_auth_id, '/a_dean/farm',
      'Modules', 'Farm Management', 'Farm voided',
      'Farm {document_no} was voided by {initiator_name}.', 'normal',
      jsonb_build_object('code', new.code, 'name', new.name, 'farmType', new.farm_type),
      'FARM_VOIDED:' || new.id::text, now()
    ) on conflict (dedupe_key) do nothing;

    return new;
  end if;

  if coalesce(old.approval_status, 'approved') <> 'approved'
     and coalesce(new.approval_status, 'approved') = 'approved' then
    insert into public.notification_outbox (
      module_key, event_key, entity_type, entity_id, document_no,
      fms_type, farm_id, recipient_farm_id, actor_auth_id, target_url,
      permission_group, permission_title, title, message, priority,
      metadata, dedupe_key, occurred_at
    ) values (
      'FARM', 'FARM_POSTED', 'farms', new.id::text, new.code,
      v_fms_type, new.id, new.id, v_actor_auth_id,
      '/a_dean/farm/' || new.id::text || '/edit',
      'Modules', 'Farm Management', 'Farm posted',
      'Farm {document_no} was posted by {initiator_name}.', 'normal',
      jsonb_build_object('code', new.code, 'name', new.name, 'farmType', new.farm_type),
      'FARM_POSTED:' || new.id::text, now()
    ) on conflict (dedupe_key) do nothing;

    return new;
  end if;

  if new.code is distinct from old.code then v_changed_fields := array_append(v_changed_fields, 'code'); end if;
  if new.name is distinct from old.name then v_changed_fields := array_append(v_changed_fields, 'name'); end if;
  if new.farm_type is distinct from old.farm_type then v_changed_fields := array_append(v_changed_fields, 'farm_type'); end if;
  if new.address is distinct from old.address then v_changed_fields := array_append(v_changed_fields, 'address'); end if;
  if new.region is distinct from old.region then v_changed_fields := array_append(v_changed_fields, 'region'); end if;
  if new.contact_person is distinct from old.contact_person then v_changed_fields := array_append(v_changed_fields, 'contact_person'); end if;
  if new.contact_number is distinct from old.contact_number then v_changed_fields := array_append(v_changed_fields, 'contact_number'); end if;
  if new.remarks is distinct from old.remarks then v_changed_fields := array_append(v_changed_fields, 'remarks'); end if;
  if cardinality(v_changed_fields) = 0 and new.updated_at is distinct from old.updated_at then
    v_changed_fields := array_append(v_changed_fields, 'setup');
  end if;

  if cardinality(v_changed_fields) > 0
     and coalesce(btrim(new.void::text), '0') = '1'
     and coalesce(new.approval_status, 'approved') = 'approved' then
    insert into public.notification_outbox (
      module_key, event_key, entity_type, entity_id, document_no,
      fms_type, farm_id, recipient_farm_id, actor_auth_id, target_url,
      permission_group, permission_title, title, message, priority,
      metadata, dedupe_key, occurred_at
    ) values (
      'FARM', 'FARM_EDITED', 'farms', new.id::text, new.code,
      v_fms_type, new.id, new.id, v_actor_auth_id,
      '/a_dean/farm/' || new.id::text || '/edit',
      'Modules', 'Farm Management', 'Farm edited',
      'Farm {document_no} was edited by {initiator_name}.', 'normal',
      jsonb_build_object(
        'code', new.code, 'name', new.name, 'farmType', new.farm_type,
        'changedFields', to_jsonb(v_changed_fields)
      ),
      'FARM_EDITED:' || new.id::text || ':' || txid_current()::text, now()
    ) on conflict (dedupe_key) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists farms_enqueue_event on public.farms;
create trigger farms_enqueue_event
after insert or update of code, name, farm_type, address, region, contact_person,
  contact_number, remarks, approval_status, void, updated_at
on public.farms
for each row
execute function public.enqueue_farm_event();

create or replace function public.void_farm(
  p_farm_id bigint,
  p_actor_auth_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_farm public.farms%rowtype;
  v_fms_type text;
begin
  if p_actor_auth_id is null or not exists (
    select 1
    from public.users app_user
    where app_user.auth_id = p_actor_auth_id
      and coalesce(btrim(app_user.isactive::text), '1') = '1'
      and (
        coalesce(app_user.user_type, 3) = 1
        or exists (
          select 1
          from public.user_permissions permission
          where permission.user_id = p_actor_auth_id
            and permission.ilink = '/a_dean/farm/void'
            and permission.is_visible
        )
      )
  ) then
    raise exception 'You do not have permission to void farms.';
  end if;

  select * into v_farm
  from public.farms
  where id = p_farm_id
  for update;

  if not found then
    raise exception 'The farm was not found.';
  end if;

  if coalesce(btrim(v_farm.void::text), '0') <> '1' then
    return to_jsonb(v_farm);
  end if;

  update public.farms
  set void = '0', updated_at = now()
  where id = p_farm_id
  returning * into v_farm;

  v_fms_type := case upper(btrim(coalesce(v_farm.farm_type, '')))
    when 'BR' then 'Broiler'
    when 'BROILER' then 'Broiler'
    when 'BE' then 'Breeder'
    when 'BREEDER' then 'Breeder'
    when 'HA' then 'Hatchery'
    when 'HATCHERY' then 'Hatchery'
    else null
  end;

  insert into public.notification_outbox (
    module_key, event_key, entity_type, entity_id, document_no,
    fms_type, farm_id, recipient_farm_id, actor_auth_id, target_url,
    permission_group, permission_title, title, message, priority,
    metadata, dedupe_key, occurred_at
  ) values (
    'FARM', 'FARM_VOIDED', 'farms', v_farm.id::text, v_farm.code,
    v_fms_type, v_farm.id, v_farm.id, p_actor_auth_id, '/a_dean/farm',
    'Modules', 'Farm Management', 'Farm voided',
    'Farm {document_no} was voided by {initiator_name}.', 'normal',
    jsonb_build_object('code', v_farm.code, 'name', v_farm.name, 'farmType', v_farm.farm_type),
    'FARM_VOIDED:' || v_farm.id::text, now()
  ) on conflict (dedupe_key) do nothing;

  return to_jsonb(v_farm);
end;
$$;

revoke all on function public.void_farm(bigint, uuid) from public;
revoke all on function public.void_farm(bigint, uuid) from anon;
revoke all on function public.void_farm(bigint, uuid) from authenticated;
grant execute on function public.void_farm(bigint, uuid) to service_role;
