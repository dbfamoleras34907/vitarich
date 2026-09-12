-- Apply after registration_profile.sql. Repairs the Auth metadata timing bug only.
-- Existing profiles, activation decisions and assignments are never overwritten.
begin;
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


-- Repair only approval-first Auth accounts whose pending profile was never created.
-- The repaired trigger enqueues the signup event in this same transaction.
update auth.users a set raw_app_meta_data = a.raw_app_meta_data
where a.raw_app_meta_data->>'registration_flow' = 'approval_first'
  and a.email is not null
  and not exists(select 1 from public.users u where u.auth_id = a.id);

revoke all on function public.register_pending_auth_account() from public,anon,authenticated;
revoke all on function public.registration_approval_ready() from public,anon,authenticated;
grant execute on function public.registration_approval_ready() to service_role;
notify pgrst, 'reload schema';
commit;
