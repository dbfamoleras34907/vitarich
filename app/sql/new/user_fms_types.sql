alter table public.users
  add column if not exists fms_types text[] not null default '{}'::text[];

update public.users
set fms_types = array[btrim(fms_type)]::text[]
where cardinality(fms_types) = 0
  and btrim(coalesce(fms_type, '')) in ('Broiler', 'Breeder', 'Hatchery');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'users_fms_types_allowed_additive_chk'
  ) then
    alter table public.users
      add constraint users_fms_types_allowed_additive_chk
      check (
        fms_types <@ array['Broiler', 'Breeder', 'Hatchery']::text[]
        and cardinality(fms_types) =
          (case when 'Broiler' = any(fms_types) then 1 else 0 end)
          + (case when 'Breeder' = any(fms_types) then 1 else 0 end)
          + (case when 'Hatchery' = any(fms_types) then 1 else 0 end)
      );
  end if;
end;
$$;

create index if not exists users_fms_types_gin_idx
  on public.users using gin (fms_types);

comment on column public.users.fms_types is
  'Independent user access scopes. Farm assignments and default_farm do not derive or modify this value.';

create function public.guard_user_fms_types_additive()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and new.fms_types is distinct from old.fms_types then
    raise exception 'FMS types must be changed through the secured admin API.';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.users'::regclass
      and tgname = 'users_guard_fms_types_additive'
      and not tgisinternal
  ) then
    create trigger users_guard_fms_types_additive
    before update of fms_types on public.users
    for each row execute function public.guard_user_fms_types_additive();
  end if;
end;
$$;

create function public.sync_registration_fms_types_additive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
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

  if cardinality(v_fms_types) > 0 then
    update public.users
    set fms_types = v_fms_types,
      fms_type = v_fms_types[1]
    where auth_id = new.id
      and cardinality(fms_types) = 0;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_registration_fms_types_additive() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname = 'zz_sync_registration_fms_types_additive'
      and not tgisinternal
  ) then
    create trigger zz_sync_registration_fms_types_additive
    after insert or update of raw_app_meta_data on auth.users
    for each row execute function public.sync_registration_fms_types_additive();
  end if;
end;
$$;
