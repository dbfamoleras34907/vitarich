create or replace function public.sync_farm_user_assignments(
  p_farm_id bigint,
  p_farm_code text,
  p_user_ids bigint[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  selected_user_ids bigint[];
  selected_user_id bigint;
begin
  if p_farm_id is null or not exists (
    select 1 from public.farms where id = p_farm_id and code = p_farm_code
  ) then
    raise exception 'Farm assignment requires a valid persisted farm.';
  end if;

  select coalesce(array_agg(distinct user_id order by user_id), array[]::bigint[])
  into selected_user_ids
  from unnest(coalesce(p_user_ids, array[]::bigint[])) as selected(user_id)
  where user_id is not null and user_id > 0;

  if exists (
    select 1
    from unnest(selected_user_ids) as selected(user_id)
    left join public.users app_user on app_user.id = selected.user_id
    where app_user.id is null
       or coalesce(app_user.user_type, 0) not in (2, 3)
       or lower(btrim(coalesce(app_user.isactive::text, ''))) not in ('1', 'true', 'active')
  ) then
    raise exception 'Assigned TA selections must be active Admin or User accounts.';
  end if;

  -- Only eligible Admin/User memberships are synchronized. Historical inactive
  -- rows and memberships for other account types are preserved.
  update public.users_farms assignment
  set void = '0'
  where coalesce(btrim(assignment.void::text), '1') = '1'
    and (
      assignment.farm_id = p_farm_id
      or (assignment.farm_id is null and assignment.farm_code = p_farm_code)
    )
    and not (assignment.users_id = any(selected_user_ids))
    and exists (
      select 1
      from public.users app_user
      where app_user.id = assignment.users_id
        and app_user.user_type in (2, 3)
    );

  foreach selected_user_id in array selected_user_ids
  loop
    update public.users_farms assignment
    set farm_id = p_farm_id,
        farm_code = p_farm_code,
        void = '1'
    where assignment.users_id = selected_user_id
      and (
        assignment.farm_id = p_farm_id
        or (assignment.farm_id is null and assignment.farm_code = p_farm_code)
      );

    if not found then
      insert into public.users_farms (
        users_id,
        farm_id,
        farm_code,
        created_by,
        void
      ) values (
        selected_user_id,
        p_farm_id,
        p_farm_code,
        auth.uid(),
        '1'
      );
    end if;
  end loop;
end;
$$;

revoke all on function public.sync_farm_user_assignments(bigint, text, bigint[]) from public;
revoke all on function public.sync_farm_user_assignments(bigint, text, bigint[]) from anon;
revoke all on function public.sync_farm_user_assignments(bigint, text, bigint[]) from authenticated;
