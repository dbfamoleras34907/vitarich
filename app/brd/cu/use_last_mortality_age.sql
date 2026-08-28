begin;

create or replace function public.get_brd_fc_last_mortality_age(p_flock_card_id bigint)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select max(line.age)::integer
  from public.flock_card card
  join public.brd_fc growing
    on growing.card_no = card.card_no
   and growing.farm_id = card.farm_id
   and growing.void = '1'
  join public.brd_fc_line line
    on line.fc_id = growing.id
   and line.void = '1'
  where card.id = p_flock_card_id
    and card.void = '1'
    and coalesce(line.mort_am, 0) + coalesce(line.mort_pm, 0) > 0;
$$;

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
      select
        card.id,
        card.building_name,
        public.get_brd_fc_last_mortality_age(card.id) as actual_age
      from public.flock_card card
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
    raise exception '% has no eligible mortality age for Clean up. Last mortality age must be at least %.', v_invalid_building, v_target_age;
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

do $$
declare
  v_function text;
  v_original text;
begin
  select pg_get_functiondef('public.post_br_cleanup_inventory()'::regprocedure)
  into v_function;
  v_original := v_function;

  if position('public.get_brd_fc_last_mortality_age(card.id) as actual_age' in v_function) > 0 then
    return;
  end if;

  v_function := replace(
    v_function,
    '      select card.id, card.building_name, growing.actual_age
      from public.flock_card card
      left join lateral (
        select daily.actual_age
        from public.brd_fc daily
        where daily.card_no = card.card_no
          and daily.farm_id = card.farm_id
          and daily.void = ''1''
        order by daily.id desc
        limit 1
      ) growing on true',
    '      select
        card.id,
        card.building_name,
        public.get_brd_fc_last_mortality_age(card.id) as actual_age
      from public.flock_card card'
  );

  if v_function = v_original
    or position('public.get_brd_fc_last_mortality_age(card.id) as actual_age' in v_function) = 0
  then
    raise exception 'The deployed post_br_cleanup_inventory function does not match the expected version. Apply br_cleanup_tables.sql instead.';
  end if;

  execute v_function;
end;
$$;

notify pgrst, 'reload schema';

commit;
