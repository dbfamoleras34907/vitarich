alter table public.users
  add column if not exists fms_type text null;

alter table public.users
  add column if not exists user_type smallint not null default 3;

alter table public.users
  drop constraint if exists users_fms_type_allowed_chk;

alter table public.users
  add constraint users_fms_type_allowed_chk
  check (fms_type is null or btrim(fms_type) in ('Broiler', 'Breeder', 'Hatchery'));

alter table public.users
  drop constraint if exists users_user_type_allowed_chk;

alter table public.users
  add constraint users_user_type_allowed_chk
  check (user_type in (1, 2, 3));

comment on column public.users.user_type is
  'User hierarchy: 1 = Super Admin, 2 = Admin/Supervisor, 3 = User.';

-- Existing records keep the safe default User role. Promote existing supervisors
-- to Admin and select the initial Super Admin manually after reviewing the data.
update public.users
set user_type = 2
where user_type = 3
  and lower(btrim(coalesce(issuper::text, ''))) in ('1', 'true', 't', 'yes');

update public.users
set issuper = case when user_type in (1, 2) then '1' else '0' end;

create index if not exists users_user_type_fms_type_idx
  on public.users (user_type, fms_type);

create or replace function public.guard_user_access_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and (
    new.user_type is distinct from old.user_type
    or new.fms_type is distinct from old.fms_type
    or new.issuper is distinct from old.issuper
  ) then
    raise exception 'User type, FMS type, and supervisor status must be changed through the secured admin API.';
  end if;
  return new;
end;
$$;

drop trigger if exists users_guard_access_fields on public.users;
create trigger users_guard_access_fields
before update on public.users
for each row execute function public.guard_user_access_fields();

create or replace function public.guard_user_permission_mutations()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null then
    raise exception 'Permissions must be changed through the secured admin API.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists user_permissions_guard_mutations on public.user_permissions;
create trigger user_permissions_guard_mutations
before insert or update or delete on public.user_permissions
for each row execute function public.guard_user_permission_mutations();
