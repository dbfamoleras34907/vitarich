alter table public.users
  add column if not exists fms_types text[] not null default '{}'::text[];

update public.users
set fms_types = array[btrim(fms_type)]::text[]
where cardinality(fms_types) = 0
  and btrim(coalesce(fms_type, '')) in ('Broiler', 'Breeder', 'Hatchery');

alter table public.users
  drop constraint if exists users_fms_types_allowed_chk;

alter table public.users
  add constraint users_fms_types_allowed_chk
  check (
    fms_types <@ array['Broiler', 'Breeder', 'Hatchery']::text[]
    and cardinality(fms_types) =
      (case when 'Broiler' = any(fms_types) then 1 else 0 end)
      + (case when 'Breeder' = any(fms_types) then 1 else 0 end)
      + (case when 'Hatchery' = any(fms_types) then 1 else 0 end)
  );

create index if not exists users_fms_types_gin_idx
  on public.users using gin (fms_types);

comment on column public.users.fms_types is
  'Independent user access scopes. Farm assignments and default_farm do not derive or modify this value.';

create or replace function public.guard_user_access_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and (
    new.user_type is distinct from old.user_type
    or new.fms_type is distinct from old.fms_type
    or new.fms_types is distinct from old.fms_types
    or new.issuper is distinct from old.issuper
  ) then
    raise exception 'User type, FMS types, and supervisor status must be changed through the secured admin API.';
  end if;
  return new;
end;
$$;

drop trigger if exists users_guard_access_fields on public.users;
create trigger users_guard_access_fields
before update on public.users
for each row execute function public.guard_user_access_fields();

-- Preserve the existing approval-first account creation flow while allowing an
-- Admin creator's complete FMS scope to be inherited by the pending user.
create or replace function public.register_pending_auth_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.users%rowtype;
  v_fms_types text[];
begin
  if new.raw_app_meta_data->>'registration_flow' is distinct from 'approval_first' then
    return new;
  end if;

  select coalesce(array_agg(value order by first_ordinal), '{}'::text[])
  into v_fms_types
  from (
    select value, min(ordinality) as first_ordinal
    from jsonb_array_elements_text(coalesce(new.raw_app_meta_data->'registration_fms_types', '[]'::jsonb))
      with ordinality as selected(value, ordinality)
    where value in ('Broiler', 'Breeder', 'Hatchery')
    group by value
  ) as valid_types;

  insert into public.users(
    auth_id,
    email,
    created_by,
    user_type,
    issuper,
    isactive,
    approval_status,
    registration_submitted_at,
    fms_type,
    fms_types
  ) values (
    new.id,
    new.email,
    coalesce((new.raw_app_meta_data->>'registration_created_by')::uuid, new.id),
    3,
    '0',
    '0',
    'pending',
    now(),
    v_fms_types[1],
    v_fms_types
  )
  on conflict (auth_id) do nothing
  returning * into u;

  if not found then return new; end if;

  update auth.users
  set banned_until = now() + interval '100 years'
  where id = new.id;

  perform public.enqueue_registration_event(
    u,
    'USER_REGISTRATION_POSTED',
    u.created_by,
    u.registration_submitted_at,
    '',
    'New registration awaiting activation: ' || new.email
  );

  return new;
end;
$$;

revoke all on function public.register_pending_auth_account() from public;

create or replace function public.decide_registration(
  p_actor_auth_id uuid,
  p_user_id bigint,
  p_decision text,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.users%rowtype;
  u public.users%rowtype;
  v_status text;
  v_key text;
begin
  if p_decision is null or p_decision not in ('activate', 'reject') then
    raise exception 'Invalid decision.';
  end if;

  select * into a from public.users where auth_id = p_actor_auth_id;
  if not found
    or coalesce(a.user_type, 3) not in (1, 2)
    or a.isactive::text is distinct from '1'
    or coalesce(a.approval_status, 'activated') <> 'activated'
    or not public.registration_personal_complete(to_jsonb(a)) then
    raise sqlstate '42501' using message = 'Administrator access is required.';
  end if;

  select * into u from public.users where id = p_user_id for update;
  if not found then raise exception 'Registration not found.'; end if;

  if a.user_type <> 1 and (
    coalesce(u.user_type, 3) <> 3
    or cardinality(a.fms_types) = 0
    or cardinality(u.fms_types) = 0
    or not (coalesce(u.fms_types, '{}'::text[]) <@ a.fms_types)
  ) then
    raise sqlstate '42501' using message = 'You cannot manage this registration.';
  end if;

  v_status := case when p_decision = 'activate' then 'activated' else 'rejected' end;
  if u.approval_status = v_status then
    return jsonb_build_object('auth_id', u.auth_id, 'approval_status', v_status);
  end if;
  if u.approval_status is distinct from 'pending' then
    raise exception 'This registration has already been decided.';
  end if;
  if p_decision = 'reject' and (nullif(btrim(p_reason), '') is null or length(p_reason) > 1000) then
    raise exception 'A rejection reason is required (up to 1,000 characters).';
  end if;
  if nullif(btrim(u.email), '') is null then raise exception 'Applicant email is missing.'; end if;

  update public.users
  set approval_status = v_status,
    isactive = case when p_decision = 'activate' then '1' else '0' end,
    "docStatus" = case when p_decision = 'activate' then 'Active' else 'Rejected' end,
    registration_decided_at = now(),
    registration_decided_by = p_actor_auth_id,
    registration_rejection_reason = case when p_decision = 'reject' then btrim(p_reason) else null end,
    updated_at = now(),
    updated_by = p_actor_auth_id
  where id = u.id
  returning * into u;

  update auth.users
  set banned_until = case when p_decision = 'activate' then null else now() + interval '100 years' end
  where id = u.auth_id;
  if not found then raise exception 'Auth account is missing.'; end if;

  insert into public.transactional_email_outbox(dedupe_key, recipient_email, template_key, payload)
  values (
    'ACCOUNT_DECISION:' || u.auth_id::text,
    u.email,
    case when p_decision = 'activate' then 'ACCOUNT_ACTIVATED' else 'ACCOUNT_REJECTED' end,
    jsonb_build_object('reason', u.registration_rejection_reason)
  )
  on conflict (dedupe_key) do nothing;

  v_key := case when p_decision = 'activate' then 'USER_REGISTRATION_EDITED' else 'USER_REGISTRATION_VOIDED' end;
  perform public.enqueue_registration_event(
    u,
    v_key,
    p_actor_auth_id,
    u.registration_decided_at,
    ':' || v_status,
    'Registration ' || v_status || ': ' || u.email,
    jsonb_build_object('changedFields', array['approval_status', 'isactive'])
  );

  return jsonb_build_object('auth_id', u.auth_id, 'approval_status', v_status);
end;
$$;

revoke all on function public.decide_registration(uuid, bigint, text, text) from public, anon, authenticated;
