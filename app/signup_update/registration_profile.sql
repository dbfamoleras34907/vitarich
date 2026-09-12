-- Approval-first signup. Apply notification_system.sql first, then this entire script.
-- Existing accounts keep their activation state. Required personal fields are checked on login.
begin;
alter table public.users add column if not exists registration_completed_at timestamptz;
alter table public.users add column if not exists registration_submitted_at timestamptz;
alter table public.users add column if not exists approval_status text;
alter table public.users add column if not exists registration_decided_at timestamptz;
alter table public.users add column if not exists registration_decided_by uuid references auth.users(id);
alter table public.users add column if not exists registration_rejection_reason text;

-- Do not convert disabled established accounts into pending applications.
update public.users set approval_status = case when isactive::text = '1' then 'activated'
  when registration_completed_at is not null then 'pending' else null end
where approval_status is null;

create table if not exists public.transactional_email_outbox (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  recipient_email text not null,
  template_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  processing_started_at timestamptz,
  lease_id uuid,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.transactional_email_outbox enable row level security;
revoke all on public.transactional_email_outbox from public, anon, authenticated;
grant all on public.transactional_email_outbox to service_role;
create index if not exists transactional_email_due_idx on public.transactional_email_outbox(status, next_attempt_at);

create or replace function public.registration_personal_complete(p_profile jsonb)
returns boolean language sql immutable set search_path = public as $$
  select not exists (select 1 from unnest(array['firstname','lastname','birthdate','location','region','archipelago']) field
    where nullif(btrim(p_profile->>field),'') is null)
    and not exists (select 1 from unnest(array['firstname','middlename','lastname','birthdate','gender','mobile','phone','location','region','archipelago']) field
      where length(p_profile->>field)>1000);
$$;

-- SECURITY DEFINER reads the authoritative account without recursive users RLS.
create or replace function public.registration_business_access()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users u where u.auth_id = auth.uid()
    and u.isactive::text = '1' and coalesce(u.approval_status, 'activated') = 'activated'
    and public.registration_personal_complete(to_jsonb(u)));
$$;

-- Runs before PostgREST queries AND SECURITY DEFINER RPCs, including stale JWTs.
create or replace function public.check_registration_access()
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Signup uses a server API. Preserve only the existing public password-reset insert.
  if auth.role() = 'anon' and not (
    coalesce(current_setting('request.path',true),'') = '/approval_requests'
    and coalesce(current_setting('request.method',true),'') = 'POST'
  ) then
    raise sqlstate '42501' using message = 'Authentication is required.';
  end if;
  if auth.role() = 'authenticated' and not public.registration_business_access() then
    raise sqlstate '42501' using message = 'Account activation and complete personal information are required.';
  end if;
end;
$$;

-- Preserve any unrelated pre-request hook instead of replacing it silently.
do $$
declare v_setting text;
begin
  select setting into v_setting from pg_roles r, unnest(coalesce(r.rolconfig, '{}'::text[])) setting
    where r.rolname = 'authenticator' and setting like 'pgrst.db_pre_request=%';
  if v_setting is not null and v_setting <> 'pgrst.db_pre_request=public.check_registration_access' then
    raise exception 'An existing PostgREST pre-request hook must be composed with check_registration_access: %', v_setting;
  end if;
end;
$$;
alter role authenticator set pgrst.db_pre_request = 'public.check_registration_access';

-- Storage and Realtime do not execute the PostgREST pre-request hook.
-- Restrictive policies retain the existing permissive RLS permission rules.
create or replace function public.registration_request_access()
returns boolean language sql stable security definer set search_path = public as $$
  select public.registration_business_access() or (
    auth.role()='anon' and coalesce(current_setting('request.path',true),'')='/approval_requests'
    and coalesce(current_setting('request.method',true),'')='POST'
  );
$$;

do $$
declare t record;
begin
  for t in select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind in ('r','p') and c.relrowsecurity
      and (n.nspname='public' or (n.nspname='storage' and c.relname='objects'))
  loop
    execute format('drop policy if exists registration_access_gate on %I.%I',t.nspname,t.relname);
    execute format('create policy registration_access_gate on %I.%I as restrictive for all to anon,authenticated using (public.registration_request_access()) with check (public.registration_request_access())',t.nspname,t.relname);
  end loop;
end;
$$;

-- Ordinary browser writes must not forge approval/profile-completion state.
create or replace function public.protect_registration_state()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('anon','authenticated') then
    if TG_OP = 'INSERT' or new.approval_status is distinct from old.approval_status
      or new.registration_submitted_at is distinct from old.registration_submitted_at
      or new.registration_completed_at is distinct from old.registration_completed_at
      or new.registration_decided_at is distinct from old.registration_decided_at
      or new.registration_decided_by is distinct from old.registration_decided_by
      or new.registration_rejection_reason is distinct from old.registration_rejection_reason
      or (old.approval_status in ('pending','rejected') and new.isactive is distinct from old.isactive) then
      raise sqlstate '42501' using message = 'Registration state is server-managed.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_registration_state on public.users;
create trigger protect_registration_state before insert or update on public.users
for each row execute function public.protect_registration_state();

create or replace function public.enqueue_registration_event(p_user public.users, p_event_key text, p_actor uuid, p_time timestamptz, p_suffix text, p_message text, p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notification_outbox(module_key,event_key,entity_type,entity_id,document_no,fms_type,
    farm_id,recipient_farm_id,actor_auth_id,target_url,permission_group,permission_title,title,message,dedupe_key,occurred_at,metadata)
  values ('USER_REGISTRATION',p_event_key,'users',p_user.id::text,p_user.email,p_user.fms_type,
    null,null,p_actor,case when p_event_key='USER_REGISTRATION_POSTED' then '/admin/user-activation'
      else '/admin/user-permissions?user=' || p_user.auth_id::text end,
    'Modules','User Management/view',p_message,p_message,
    p_event_key || ':' || p_user.auth_id::text || p_suffix,p_time,p_metadata)
  on conflict (dedupe_key) do nothing;
end;
$$;

-- GoTrue writes app metadata after INSERT, within the same Auth creation transaction.
create or replace function public.register_pending_auth_account()
returns trigger language plpgsql security definer set search_path = public as $$
declare u public.users%rowtype;
begin
  if new.raw_app_meta_data->>'registration_flow' is distinct from 'approval_first' then return new; end if;
  insert into public.users(auth_id,email,created_by,user_type,issuper,isactive,approval_status,registration_submitted_at,fms_type)
    values(new.id,new.email,coalesce((new.raw_app_meta_data->>'registration_created_by')::uuid,new.id),3,'0','0','pending',now(),
      new.raw_app_meta_data->>'registration_fms_type')
    on conflict (auth_id) do nothing returning * into u;
  -- Later metadata updates must not reset an activated/rejected account or repeat its event.
  if not found then return new; end if;
  update auth.users set banned_until=now()+interval '100 years' where id=new.id;
  perform public.enqueue_registration_event(u,'USER_REGISTRATION_POSTED',u.created_by,u.registration_submitted_at,'',
    'New registration awaiting activation: ' || new.email);
  return new;
end;
$$;
drop trigger if exists register_pending_auth_account on auth.users;
create trigger register_pending_auth_account after insert or update of raw_app_meta_data on auth.users
for each row execute function public.register_pending_auth_account();

create or replace function public.registration_approval_ready()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and tgname='register_pending_auth_account'
    and tgenabled in ('O','A') and (tgtype::integer & 20) = 20) then
    raise exception 'Registration trigger must handle Auth insertion and application metadata updates.';
  end if;
  return true;
end;
$$;

create or replace function public.decide_registration(p_actor_auth_id uuid,p_user_id bigint,p_decision text,p_reason text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare a public.users%rowtype; u public.users%rowtype; v_status text; v_key text;
begin
  if p_decision is null or p_decision not in ('activate','reject') then raise exception 'Invalid decision.'; end if;
  select * into a from public.users where auth_id=p_actor_auth_id;
  if not found or coalesce(a.user_type,3) not in (1,2) or a.isactive::text is distinct from '1'
    or coalesce(a.approval_status,'activated') <> 'activated' or not public.registration_personal_complete(to_jsonb(a)) then
    raise sqlstate '42501' using message='Administrator access is required.';
  end if;
  select * into u from public.users where id=p_user_id for update;
  if not found then raise exception 'Registration not found.'; end if;
  if a.user_type <> 1 and (coalesce(u.user_type,3) <> 3 or a.fms_type is null or u.fms_type is distinct from a.fms_type) then
    raise sqlstate '42501' using message='You cannot manage this registration.';
  end if;
  v_status := case when p_decision='activate' then 'activated' else 'rejected' end;
  if u.approval_status = v_status then return jsonb_build_object('auth_id',u.auth_id,'approval_status',v_status); end if;
  if u.approval_status is distinct from 'pending' then raise exception 'This registration has already been decided.'; end if;
  if p_decision='reject' and (nullif(btrim(p_reason),'') is null or length(p_reason)>1000) then raise exception 'A rejection reason is required (up to 1,000 characters).'; end if;
  if nullif(btrim(u.email),'') is null then raise exception 'Applicant email is missing.'; end if;
  update public.users set approval_status=v_status,isactive=case when p_decision='activate' then '1' else '0' end,
    "docStatus"=case when p_decision='activate' then 'Active' else 'Rejected' end,
    registration_decided_at=now(),registration_decided_by=p_actor_auth_id,
    registration_rejection_reason=case when p_decision='reject' then btrim(p_reason) else null end,
    updated_at=now(),updated_by=p_actor_auth_id where id=u.id returning * into u;
  -- Auth login eligibility, decision, outbox and applicant email commit atomically.
  update auth.users set banned_until=case when p_decision='activate' then null else now()+interval '100 years' end where id=u.auth_id;
  if not found then raise exception 'Auth account is missing.'; end if;
  insert into public.transactional_email_outbox(dedupe_key,recipient_email,template_key,payload)
    values('ACCOUNT_DECISION:' || u.auth_id::text,u.email,
      case when p_decision='activate' then 'ACCOUNT_ACTIVATED' else 'ACCOUNT_REJECTED' end,
      jsonb_build_object('reason',u.registration_rejection_reason)) on conflict(dedupe_key) do nothing;
  v_key := case when p_decision='activate' then 'USER_REGISTRATION_EDITED' else 'USER_REGISTRATION_VOIDED' end;
  perform public.enqueue_registration_event(u,v_key,p_actor_auth_id,u.registration_decided_at,':' || v_status,
    'Registration ' || v_status || ': ' || u.email,jsonb_build_object('changedFields',array['approval_status','isactive']));
  return jsonb_build_object('auth_id',u.auth_id,'approval_status',v_status);
end;
$$;

create or replace function public.complete_registration_profile(p_auth_id uuid,p_profile jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare u public.users%rowtype; v_field text;
begin
  select * into u from public.users where auth_id=p_auth_id for update;
  if not found or u.isactive::text is distinct from '1' or coalesce(u.approval_status,'activated') <> 'activated' then
    raise sqlstate '42501' using message='Your account must be activated first.';
  end if;
  if not public.registration_personal_complete(p_profile) then raise exception 'Complete all required personal information.'; end if;
  foreach v_field in array array['firstname','middlename','lastname','birthdate','gender','mobile','phone','location','region','archipelago'] loop
    if jsonb_typeof(p_profile->v_field) not in ('string','null') or length(p_profile->>v_field)>1000 then raise exception 'Invalid personal information: %',v_field; end if;
  end loop;
  perform (p_profile->>'birthdate')::date;
  -- This endpoint only completes missing information; ordinary later edits use User Information.
  if public.registration_personal_complete(to_jsonb(u)) then return; end if;
  update public.users set firstname=btrim(p_profile->>'firstname'),middlename=btrim(p_profile->>'middlename'),
    lastname=btrim(p_profile->>'lastname'),birthdate=(p_profile->>'birthdate')::date,gender=p_profile->>'gender',
    mobile=p_profile->>'mobile',phone=p_profile->>'phone',location=btrim(p_profile->>'location'),
    region=btrim(p_profile->>'region'),archipelago=btrim(p_profile->>'archipelago'),
    registration_completed_at=now(),updated_at=now(),updated_by=p_auth_id where id=u.id returning * into u;
  perform public.enqueue_registration_event(u,'USER_REGISTRATION_EDITED',p_auth_id,u.registration_completed_at,':profile',
    'Personal information completed: ' || u.email,
    jsonb_build_object('changedFields',array['firstname','middlename','lastname','birthdate','gender','mobile','phone','location','region','archipelago']));
end;
$$;

create or replace function public.claim_transactional_emails(p_limit integer default 20)
returns setof public.transactional_email_outbox language sql security definer set search_path = public as $$
  with due as (
    select id from public.transactional_email_outbox
    where (status in ('pending','failed') and next_attempt_at<=now())
      or (status='processing' and processing_started_at<now()-interval '10 minutes')
    order by created_at for update skip locked limit greatest(1,least(coalesce(p_limit,20),100))
  ) update public.transactional_email_outbox q set status='processing',processing_started_at=now(),
    lease_id=gen_random_uuid(),attempt_count=attempt_count+1 from due where q.id=due.id returning q.*;
$$;
create or replace function public.finish_transactional_email(p_id uuid,p_lease_id uuid,p_success boolean,p_error text default null)
returns void language sql security definer set search_path = public as $$
  update public.transactional_email_outbox set status=case when p_success then 'sent' else 'failed' end,
    sent_at=case when p_success then now() else null end,last_error=case when p_success then null else left(p_error,2000) end,
    next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,least(attempt_count,7))::integer)),processing_started_at=null
  where id=p_id and lease_id=p_lease_id and status='processing';
$$;

insert into public.notification_rules(name,module_key,event_key,user_types,email_enabled,require_view_permission)
select 'New registration awaiting activation','USER_REGISTRATION','USER_REGISTRATION_POSTED',array[1]::smallint[],true,true
where not exists(select 1 from public.notification_rules where module_key='USER_REGISTRATION' and event_key='USER_REGISTRATION_POSTED');

-- New account requests have no assigned farm. All registration events explicitly use routing=none.
revoke all on function public.enqueue_registration_event(public.users,text,uuid,timestamptz,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.register_pending_auth_account() from public,anon,authenticated;
revoke all on function public.protect_registration_state() from public,anon,authenticated;
revoke all on function public.registration_approval_ready() from public,anon,authenticated;
revoke all on function public.decide_registration(uuid,bigint,text,text) from public,anon,authenticated;
revoke all on function public.complete_registration_profile(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.claim_transactional_emails(integer) from public,anon,authenticated;
revoke all on function public.finish_transactional_email(uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.registration_approval_ready(),public.decide_registration(uuid,bigint,text,text),
  public.complete_registration_profile(uuid,jsonb),public.claim_transactional_emails(integer),
  public.finish_transactional_email(uuid,uuid,boolean,text) to service_role;
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
commit;
