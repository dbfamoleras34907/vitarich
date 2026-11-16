-- Keep the persisted opening inventory in sync with all prior breeder
-- movements.  Transfer posting updates the row for its transaction date;
-- without this trigger, a row created before prior Transfer In transactions
-- can retain a stale inv_* value and reject a valid later Transfer Out.
begin;

create or replace function public.sync_breeder_daily_performance_opening_inventory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_male numeric;
  v_base_female numeric;
  v_history_male numeric;
  v_history_female numeric;
begin
  select
    coalesce(
      placement.m_endingbalance,
      coalesce(placement.m_beg, 0)
        - coalesce(placement.m_doa, 0)
        - coalesce(placement.m_reject, 0)
        - coalesce(placement.m_shortcount, 0)
    ),
    coalesce(
      placement.f_endingbalance,
      coalesce(placement.f_beg, 0)
        - coalesce(placement.f_doa, 0)
        - coalesce(placement.f_reject, 0)
        - coalesce(placement.f_shortcount, 0)
    )
  into v_base_male, v_base_female
  from public.tbl_placement placement
  where placement.id = new.placement_id;

  if not found then
    raise exception 'Breeder daily performance requires a valid placement.';
  end if;

  select
    coalesce(sum(
      coalesce(performance.trans_in_male, 0)
        - coalesce(performance.mc_male, 0)
        - coalesce(performance.cull_male, 0)
        - coalesce(performance.trans_out_male, 0)
        - coalesce(performance.kitchen_male, 0)
        - coalesce(performance.condem_male, 0)
    ), 0),
    coalesce(sum(
      coalesce(performance.trans_in_female, 0)
        - coalesce(performance.mc_female, 0)
        - coalesce(performance.cull_female, 0)
        - coalesce(performance.trans_out_female, 0)
        - coalesce(performance.kitchen_female, 0)
        - coalesce(performance.condem_female, 0)
    ), 0)
  into v_history_male, v_history_female
  from public.tbl_breeder_daily_performance performance
  where performance.placement_id = new.placement_id
    and performance.isactive = true
    and performance.daterec < new.daterec
    and performance.id is distinct from new.id;

  new.inv_male := v_base_male + v_history_male;
  new.inv_female := v_base_female + v_history_female;
  return new;
end;
$$;

drop trigger if exists tbl_breeder_daily_performance_opening_inventory
  on public.tbl_breeder_daily_performance;

create trigger tbl_breeder_daily_performance_opening_inventory
before insert or update of
  placement_id,
  daterec,
  inv_male,
  inv_female,
  mc_male,
  mc_female,
  cull_male,
  cull_female,
  trans_in_male,
  trans_in_female,
  trans_out_male,
  trans_out_female,
  kitchen_male,
  kitchen_female,
  condem_male,
  condem_female,
  isactive
on public.tbl_breeder_daily_performance
for each row
execute function public.sync_breeder_daily_performance_opening_inventory();

commit;
