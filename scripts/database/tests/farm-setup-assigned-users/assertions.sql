-- DISPOSABLE LOCAL TEST ONLY.
-- This file depends on fixture.sql and must not be run in a Supabase project.
do $$
begin
  if not exists (
    select 1
    from public.farms
    where id = 10 and code = 'FRM000010'
  ) then
    raise exception using message =
      'Farm Setup assignment test fixture is missing. Run fixture.sql first in a fresh disposable local database; do not run assertions.sql in Supabase.';
  end if;
end;
$$;

select public.sync_farm_user_assignments(10, 'FRM000010', array[1, 2]::bigint[]);

do $$
begin
  if (select count(*) from public.users_farms where farm_id = 10 and void = '1' and users_id in (1, 2)) <> 2 then
    raise exception 'Multiple active Admin/User assignments were not saved.';
  end if;

  if not exists (select 1 from public.users_farms where farm_id = 10 and users_id = 4 and void = '1') then
    raise exception 'The unrelated Super Admin membership was changed.';
  end if;
end;
$$;

select public.sync_farm_user_assignments(10, 'FRM000010', array[2]::bigint[]);

do $$
begin
  if not exists (select 1 from public.users_farms where farm_id = 10 and users_id = 1 and void = '0') then
    raise exception 'Removed eligible assignment was not deactivated.';
  end if;

  if not exists (select 1 from public.users_farms where farm_id = 10 and users_id = 2 and void = '1') then
    raise exception 'Selected eligible assignment was not kept active.';
  end if;
end;
$$;

do $$
declare
  invalid_user_rejected boolean := false;
begin
  begin
    perform public.sync_farm_user_assignments(10, 'FRM000010', array[3]::bigint[]);
  exception when others then
    if sqlerrm = 'Assigned TA selections must be active Admin or User accounts.' then
      invalid_user_rejected := true;
    else
      raise;
    end if;
  end;

  if not invalid_user_rejected then
    raise exception 'Inactive user assignment was accepted.';
  end if;
end;
$$;

select public.sync_farm_user_assignments(10, 'FRM000010', array[]::bigint[]);

do $$
begin
  if exists (
    select 1
    from public.users_farms assignment
    join public.users app_user on app_user.id = assignment.users_id
    where assignment.farm_id = 10
      and assignment.void = '1'
      and app_user.user_type in (2, 3)
  ) then
    raise exception 'Empty optional selection did not deactivate eligible assignments.';
  end if;

  if not exists (select 1 from public.users_farms where farm_id = 10 and users_id = 4 and void = '1') then
    raise exception 'Unrelated membership was not preserved after clearing assignments.';
  end if;
end;
$$;
