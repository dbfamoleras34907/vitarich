begin;

alter table public.br_delivery
  add column if not exists hauler_name text null,
  add column if not exists plate_number text null,
  add column if not exists truck_seal numeric null,
  add column if not exists destination text null,
  add column if not exists live_sales_customer_name text null;

alter table public.br_delivery
  alter column hauler_name type text using hauler_name::text,
  alter column plate_number type text using plate_number::text;

commit;
