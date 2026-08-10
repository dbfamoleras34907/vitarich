begin;

alter table public.br_delivery
  add column if not exists hauler_name text null,
  add column if not exists plate_number numeric null,
  add column if not exists truck_seal numeric null,
  add column if not exists destination text null;

alter table public.br_delivery
  alter column hauler_name type text using hauler_name::text;

commit;
