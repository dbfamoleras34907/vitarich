alter table public.users
  add column if not exists fms_type text null;

alter table public.users
  drop constraint if exists users_fms_type_allowed_chk;

alter table public.users
  add constraint users_fms_type_allowed_chk
  check (
    fms_type is null
    or btrim(fms_type) in ('Broiler', 'Breeder', 'Hatchery')
  )
  not valid;
