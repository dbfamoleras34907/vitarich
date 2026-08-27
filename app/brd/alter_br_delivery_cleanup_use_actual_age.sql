begin;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'brd_fc'
      and column_name = 'actual_age'
  ) then
    raise exception 'Apply alter_brd_fc_add_actual_age_and_reverse_order.sql before this migration.';
  end if;
end;
$$;

create or replace function public.validate_br_delivery_actual_age()
returns trigger
language plpgsql
as $$
declare
  v_target_age integer := 0;
  v_invalid_building text;
begin
  select coalesce(settings.target_delivery_age, 0)
  into v_target_age
  from public.brd_dr_settings settings
  where settings.farm_id = new.farm_id
    and settings.void = '1'
  order by settings.created_at desc
  limit 1;

  v_target_age := coalesce(v_target_age, 0);

  with selected_buildings as (
    select distinct line.from_warehouse_id, line.from_warehouse_code
    from public.br_delivery_lines line
    where line.br_delivery_id = new.id
      and line.void = '1'
  ), active_cycles as (
    select selected.from_warehouse_code, cycle.id, cycle.building_name, cycle.actual_age
    from selected_buildings selected
    left join lateral (
      select card.id, card.building_name, growing.actual_age
      from public.flock_card card
      left join lateral (
        select daily.actual_age
        from public.brd_fc daily
        where daily.card_no = card.card_no
          and daily.farm_id = card.farm_id
          and daily.void = '1'
        order by daily.id desc
        limit 1
      ) growing on true
      where card.farm_id = new.farm_id
        and card.void = '1'
        and card.status = 'Saved'
        and (
          (selected.from_warehouse_id is not null and card.building_whse_id = selected.from_warehouse_id)
          or card.building_code = selected.from_warehouse_code
        )
      order by card.start_date desc, card.id desc
      limit 1
    ) cycle on true
  )
  select coalesce(active.building_name, active.from_warehouse_code)
  into v_invalid_building
  from active_cycles active
  where active.id is null
     or active.actual_age is null
     or active.actual_age < v_target_age
  limit 1;

  if v_invalid_building is not null then
    raise exception '% has no eligible Growing age for Harvest & Delivery. Actual age must be at least %.', v_invalid_building, v_target_age;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_br_delivery_actual_age_trigger on public.br_delivery;
create trigger validate_br_delivery_actual_age_trigger
before update of status on public.br_delivery
for each row
when (new.status = 'Posted' and old.status is distinct from 'Posted')
execute function public.validate_br_delivery_actual_age();

create or replace function public.validate_br_cleanup_actual_age()
returns trigger
language plpgsql
as $$
declare
  v_target_age integer := 0;
  v_invalid_building text;
begin
  select coalesce(settings.target_cleanup_age, 0)
  into v_target_age
  from public.brd_cu_settings settings
  where settings.farm_id = new.farm_id
    and settings.void = '1'
  order by settings.created_at desc
  limit 1;

  v_target_age := coalesce(v_target_age, 0);

  with selected_buildings as (
    select distinct line.from_warehouse_id, line.from_warehouse_code
    from public.br_cleanup_lines line
    where line.br_cleanup_id = new.id
      and line.void = '1'
  ), active_cycles as (
    select selected.from_warehouse_code, cycle.id, cycle.building_name, cycle.actual_age
    from selected_buildings selected
    left join lateral (
      select card.id, card.building_name, growing.actual_age
      from public.flock_card card
      left join lateral (
        select daily.actual_age
        from public.brd_fc daily
        where daily.card_no = card.card_no
          and daily.farm_id = card.farm_id
          and daily.void = '1'
        order by daily.id desc
        limit 1
      ) growing on true
      where card.farm_id = new.farm_id
        and card.void = '1'
        and card.status = 'Saved'
        and (
          (selected.from_warehouse_id is not null and card.building_whse_id = selected.from_warehouse_id)
          or card.building_code = selected.from_warehouse_code
        )
      order by card.start_date desc, card.id desc
      limit 1
    ) cycle on true
  )
  select coalesce(active.building_name, active.from_warehouse_code)
  into v_invalid_building
  from active_cycles active
  where active.id is null
     or active.actual_age is null
     or active.actual_age < v_target_age
  limit 1;

  if v_invalid_building is not null then
    raise exception '% has no eligible Growing age for Clean up. Actual age must be at least %.', v_invalid_building, v_target_age;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_br_cleanup_actual_age_trigger on public.br_cleanup;
create trigger validate_br_cleanup_actual_age_trigger
before update of status on public.br_cleanup
for each row
when (new.status = 'Posted' and old.status is distinct from 'Posted')
execute function public.validate_br_cleanup_actual_age();

notify pgrst, 'reload schema';

commit;
