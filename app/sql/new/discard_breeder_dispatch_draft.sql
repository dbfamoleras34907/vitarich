-- Discards an unposted Breeder Dispatch and all of its saved lines atomically.
-- The register is exposed through a view, so this function performs the same
-- active-user, module-permission, and farm-assignment checks before bypassing
-- the base-table RLS policies.
begin;

create or replace function public.discard_breeder_dispatch_draft(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.users%rowtype;
  v_dispatch public.tbl_brd_dispatch%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_actor
  from public.users
  where auth_id = auth.uid()
    and btrim(coalesce(isactive::text, '0')) = '1';
  if not found then
    raise exception 'The signed-in user profile is inactive or missing.' using errcode = '42501';
  end if;

  -- Lock and verify the header before removing dependent rows. This keeps a
  -- concurrent post from turning into a partial draft deletion.
  select * into v_dispatch
  from public.tbl_brd_dispatch
  where id = p_id
    and status = 'Draft'
  for update;
  if not found then
    raise exception 'Only a draft dispatch can be discarded';
  end if;

  if coalesce(v_actor.user_type, 3) <> 1 and not exists (
    select 1
    from public.user_permissions permission
    where permission.user_id = auth.uid()
      and permission.ilink = '/jmb/breederdispatch'
      and permission.is_visible
  ) then
    raise exception 'You do not have permission to discard Breeder Dispatch drafts.' using errcode = '42501';
  end if;

  if coalesce(v_actor.user_type, 3) <> 1 and not exists (
    select 1
    from public.users_farms assignment
    where assignment.users_id = v_actor.id
      and assignment.farm_id = v_dispatch.farm_id
      and btrim(coalesce(assignment.void::text, '0')) = '1'
  ) then
    raise exception 'You are not assigned to this dispatch farm.' using errcode = '42501';
  end if;

  delete from public.tbl_brd_dispatch_line
  where dispatch_id = p_id;

  delete from public.tbl_brd_dispatch
  where id = p_id
    and status = 'Draft';

  if not found then
    raise exception 'Only an accessible draft dispatch can be discarded';
  end if;
end;
$$;

revoke all on function public.discard_breeder_dispatch_draft(bigint) from public, anon;
grant execute on function public.discard_breeder_dispatch_draft(bigint) to authenticated;
notify pgrst, 'reload schema';

commit;
