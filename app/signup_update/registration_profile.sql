-- Apply notification_system.sql first, then this entire script.
-- The API verifies the bearer token and supplies p_auth_id; browsers cannot call this RPC.
begin;

alter table public.users add column if not exists registration_completed_at timestamptz;

-- Seed the requested audience once; reruns preserve disabled/edited rules.
insert into public.notification_rules (
  name, module_key, event_key, user_types, email_enabled, require_view_permission
)
select 'New registration awaiting approval', 'USER_REGISTRATION', 'USER_REGISTRATION_POSTED',
  array[1]::smallint[], true, true
where not exists (
  select 1 from public.notification_rules
  where module_key = 'USER_REGISTRATION' and event_key = 'USER_REGISTRATION_POSTED'
);

create or replace function public.complete_registration_profile(p_auth_id uuid, p_profile jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_farm public.farms%rowtype;
  v_user public.users%rowtype;
  v_user_id public.users.id%type;
  v_farm_id bigint;
  v_fms text := p_profile->>'fms_type';
  v_field text;
begin
  -- Serialize repeated registration requests before any profile/assignment write.
  select email into v_email from auth.users where id = p_auth_id for update;
  if not found then raise exception 'Registration account not found.'; end if;

  if v_fms is null or v_fms not in ('Broiler', 'Breeder', 'Hatchery') then
    raise exception 'Choose Broiler, Breeder, or Hatchery.';
  end if;
  if coalesce(jsonb_typeof(p_profile->'farm_id'), '') <> 'number'
    or coalesce(p_profile->>'farm_id', '') !~ '^[1-9][0-9]*$' then
    raise exception 'Farm is required. Choose a farm.';
  end if;
  v_farm_id := (p_profile->>'farm_id')::bigint;
  foreach v_field in array array['firstname', 'lastname', 'birthdate', 'location', 'region', 'archipelago'] loop
    if nullif(btrim(p_profile->>v_field), '') is null then
      raise exception 'Required personal information is missing: %.', v_field;
    end if;
  end loop;
  -- Validate before any writes; the date cast rejects impossible dates.
  perform (p_profile->>'birthdate')::date;

  select * into v_farm from public.farms
  where id = v_farm_id and void::text = '1' and approval_status = 'approved'
  for share;
  if not found or nullif(btrim(v_farm.code), '') is null then
    raise exception 'Selected farm is no longer active and approved. Please choose another farm.';
  end if;

  select * into v_user from public.users where auth_id = p_auth_id for update;
  if found then
    -- Signup cannot alter an activated account or replace administrator assignments.
    if coalesce(v_user.user_type, 3) <> 3 or coalesce(v_user.issuper::text, '0') <> '0'
      or coalesce(v_user.isactive::text, '0') <> '0' then
      raise exception 'Registration is already complete. Please contact your administrator to update your profile.';
    end if;
    if v_user.fms_type is not null and v_user.fms_type is distinct from v_fms then
      raise exception 'Your profile already has a different FMS Type. Please contact your administrator.';
    end if;
    if nullif(v_user.default_farm, '') is not null and v_user.default_farm is distinct from v_farm.code then
      raise exception 'Your profile already has a different default farm. Please contact your administrator.';
    end if;
    if exists (
      select 1 from public.users_farms uf where uf.users_id = v_user.id and uf.void::text = '1'
        and (uf.farm_id = v_farm.id or (uf.farm_id is null and uf.farm_code = v_farm.code)) is not true
    ) then
      raise exception 'Your profile already has different farm assignments. Please contact your administrator.';
    end if;
    v_user_id := v_user.id;
  else
    insert into public.users (
      auth_id, email, created_by, user_type, issuper, isactive, fms_type, default_farm,
      firstname, middlename, lastname, birthdate, gender, mobile, phone, location, region, archipelago
    ) values (
      p_auth_id, v_email, p_auth_id, 3, '0', '0', v_fms, v_farm.code,
      p_profile->>'firstname', p_profile->>'middlename', p_profile->>'lastname', (p_profile->>'birthdate')::date,
      p_profile->>'gender', p_profile->>'mobile', p_profile->>'phone', p_profile->>'location',
      p_profile->>'region', p_profile->>'archipelago'
    ) returning id into v_user_id;
  end if;

  update public.users set
    firstname = p_profile->>'firstname', middlename = p_profile->>'middlename', lastname = p_profile->>'lastname',
    birthdate = (p_profile->>'birthdate')::date, gender = p_profile->>'gender',
    mobile = p_profile->>'mobile', phone = p_profile->>'phone', location = p_profile->>'location',
    region = p_profile->>'region', archipelago = p_profile->>'archipelago',
    fms_type = v_fms, default_farm = v_farm.code, updated_by = p_auth_id, updated_at = now()
  where id = v_user_id;

  -- Reuse a matching assignment on retries; persist the canonical numeric ID and code together.
  update public.users_farms set farm_id = v_farm.id, farm_code = v_farm.code, void = '1'
  where users_id = v_user_id
    and (farm_id = v_farm.id or (farm_id is null and farm_code = v_farm.code));
  if not found then
    insert into public.users_farms (users_id, farm_id, farm_code, created_by, void)
    values (v_user_id, v_farm.id, v_farm.code, p_auth_id, '1');
  end if;
  -- Completion and its notification commit together, once per Auth account.
  update public.users set registration_completed_at = now()
  where id = v_user_id and registration_completed_at is null
  returning * into v_user;
  if found then
    insert into public.notification_outbox (
      module_key, event_key, entity_type, entity_id, document_no, fms_type,
      farm_id, recipient_farm_id, actor_auth_id, target_url,
      permission_group, permission_title, title, message, dedupe_key, occurred_at, metadata
    ) values (
      'USER_REGISTRATION', 'USER_REGISTRATION_POSTED', 'users', v_user.id::text,
      v_user.email, v_user.fms_type, null, null, v_user.auth_id, '/admin/user',
      'Modules', 'User Management/view', 'New user registered - approval required',
      format('%s (%s) has completed registration and is waiting for approval and module assignment. Open User Management to review the account.',
        concat_ws(' ', v_user.firstname, v_user.lastname), v_user.email),
      'USER_REGISTRATION_POSTED:' || v_user.auth_id::text,
      v_user.registration_completed_at,
      jsonb_build_object('farmCode', v_farm.code, 'farmName', v_farm.name)
    ) on conflict (dedupe_key) do nothing;
  end if;
  -- Any error rolls back the profile, default farm, assignment, and event together.
end;
$$;

revoke all on function public.complete_registration_profile(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.complete_registration_profile(uuid, jsonb) to service_role;

commit;
