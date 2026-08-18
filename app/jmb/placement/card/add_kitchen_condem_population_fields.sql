begin;

alter table public.tbl_breeder_daily_performance
  add column if not exists kitchen_female integer not null default 0,
  add column if not exists kitchen_male integer not null default 0,
  add column if not exists condem_female integer not null default 0,
  add column if not exists condem_male integer not null default 0;

alter table public.tbl_breeder_daily_performance
  drop constraint if exists tbl_breeder_daily_performance_kitchen_female_check,
  drop constraint if exists tbl_breeder_daily_performance_kitchen_male_check,
  drop constraint if exists tbl_breeder_daily_performance_condem_female_check,
  drop constraint if exists tbl_breeder_daily_performance_condem_male_check;

alter table public.tbl_breeder_daily_performance
  add constraint tbl_breeder_daily_performance_kitchen_female_check check (kitchen_female >= 0),
  add constraint tbl_breeder_daily_performance_kitchen_male_check check (kitchen_male >= 0),
  add constraint tbl_breeder_daily_performance_condem_female_check check (condem_female >= 0),
  add constraint tbl_breeder_daily_performance_condem_male_check check (condem_male >= 0);

create or replace function public.brd_flock_balance(
  p_placement_id bigint,
  p_as_of_date date,
  p_sex text
) returns numeric language sql stable as $$
  select greatest(0, coalesce(
    case when p_sex = 'male'
      then placement.m_endingbalance
      else placement.f_endingbalance
    end,
    case when p_sex = 'male'
      then placement.m_beg - placement.m_doa - placement.m_reject - placement.m_shortcount
      else placement.f_beg - placement.f_doa - placement.f_reject - placement.f_shortcount
    end,
    0
  ) + coalesce(sum(
    case when p_sex = 'male'
      then daily.trans_in_male - daily.mc_male - daily.cull_male - daily.trans_out_male
        - daily.kitchen_male - daily.condem_male
      else daily.trans_in_female - daily.mc_female - daily.cull_female - daily.trans_out_female
        - daily.kitchen_female - daily.condem_female
    end
  ), 0))
  from public.tbl_placement placement
  left join public.tbl_breeder_daily_performance daily
    on daily.placement_id = placement.id
   and daily.isactive = true
   and daily.daterec <= p_as_of_date
  where placement.id = p_placement_id
  group by placement.id;
$$;

commit;
