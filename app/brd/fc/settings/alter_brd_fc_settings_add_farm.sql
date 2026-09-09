alter table public.brd_fc_settings
  add column if not exists farm_id integer;

alter table public.brd_fc_settings
  add column if not exists farm_code text null;

alter table public.brd_fc_settings
  add column if not exists farm_name text null;

create index if not exists brd_fc_settings_farm_idx
  on public.brd_fc_settings (farm_id);

create unique index if not exists brd_fc_settings_active_farm_uidx
  on public.brd_fc_settings (farm_id)
  where void = '1';
