begin;

alter table public.br_delivery_lines
  add column if not exists ts_dr_no text null;

commit;
