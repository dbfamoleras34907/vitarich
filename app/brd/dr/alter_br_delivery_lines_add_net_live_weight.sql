begin;

-- Apply before save_br_delivery_transaction.sql. Existing rows remain blank.
-- Weight is the visible allocation-group total, repeated on its batch lines;
-- consumers must take one value per allocation_group_key, never sum it.
alter table public.br_delivery_lines
  add column if not exists net_live_weight numeric;
alter table public.br_delivery_lines
  drop constraint if exists br_delivery_lines_net_live_weight_check;
alter table public.br_delivery_lines
  add constraint br_delivery_lines_net_live_weight_check
  check (net_live_weight >= 0 and net_live_weight < 'Infinity'::numeric);

alter table public.br_delivery
  add column if not exists notification_revision bigint not null default 0,
  add column if not exists notification_fingerprint text;
-- Existing legacy rows may require repair; every new/updated header must qualify.
alter table public.br_delivery drop constraint if exists br_delivery_farm_required;
alter table public.br_delivery add constraint br_delivery_farm_required
  check (farm_id is not null) not valid;

notify pgrst, 'reload schema';
commit;
