begin;

alter table public.br_delivery_lines
  add column if not exists hauler_name text null,
  add column if not exists plate_number text null,
  add column if not exists destination text null,
  add column if not exists live_sales_customer_name text null,
  add column if not exists truck_seal numeric null;

commit;
