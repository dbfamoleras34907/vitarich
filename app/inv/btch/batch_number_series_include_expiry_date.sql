alter table public.batch_number_series
  add column if not exists include_expiry_date boolean not null default true;
