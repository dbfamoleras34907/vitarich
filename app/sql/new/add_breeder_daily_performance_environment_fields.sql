alter table public.tbl_breeder_daily_performance
  add column if not exists water_am integer null,
  add column if not exists water_pm integer null,
  add column if not exists temp_am integer null,
  add column if not exists temp_pm integer null;
