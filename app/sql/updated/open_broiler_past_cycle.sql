-- Apply after app/sql/updated/broiler_cycle_management.sql.
-- Creates a new empty Past Open Cycle for one historical month when the
-- selected building has no other open cycle.
begin;

create or replace function public.open_broiler_past_cycle(
  p_farm_id bigint,
  p_building_whse_id bigint,
  p_cycle_month date
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_user public.users%rowtype;
  v_farm public.farms%rowtype;
  v_building public.i_warehouse%rowtype;
  v_cycle public.doc_farm_cycles%rowtype;
  v_flock_card_id bigint;
  v_next_cycle bigint;
  v_cycle_mask text;
  v_today date := timezone('Asia/Manila', now())::date;
begin
  if v_actor is null then
    raise exception 'An authenticated user is required to manage Broiler cycles.' using errcode = '42501';
  end if;

  select * into v_user
  from public.users app_user
  where app_user.auth_id = v_actor
    and coalesce(btrim(app_user.isactive::text), '1') = '1';

  if not found or (
    coalesce(v_user.user_type, 3) <> 1
    and not exists (
      select 1
      from public.user_permissions permission
      where permission.user_id = v_actor
        and permission.ilink = '/brd/cycle-master/edit'
        and permission.is_visible
    )
  ) then
    raise exception 'You do not have permission to manage Cycle Master.' using errcode = '42501';
  end if;

  if p_farm_id is null or p_farm_id <= 0 then
    raise exception 'Select a valid farm.';
  end if;
  if p_building_whse_id is null or p_building_whse_id <= 0 then
    raise exception 'Select a valid building.';
  end if;
  if p_cycle_month is null
    or p_cycle_month <> date_trunc('month', p_cycle_month)::date
    or p_cycle_month >= date_trunc('month', v_today)::date then
    raise exception 'Open Past Cycle requires a month before the current month.';
  end if;

  select * into v_farm from public.farms farm where farm.id = p_farm_id;
  if not found then raise exception 'The selected farm was not found.'; end if;

  if coalesce(v_user.user_type, 3) <> 1 and not exists (
    select 1
    from public.users_farms assignment
    where assignment.users_id = v_user.id
      and assignment.farm_id = p_farm_id
      and coalesce(btrim(assignment.void::text), '1') = '1'
  ) then
    raise exception 'You do not have access to this cycle farm.' using errcode = '42501';
  end if;

  select * into v_building
  from public.i_warehouse warehouse
  where warehouse.id = p_building_whse_id;
  if not found then raise exception 'The selected building was not found.'; end if;

  if coalesce(v_building.warehouse_type, '') <> 'Building'
    or not coalesce(v_building.is_active, false)
    or not (
      nullif(btrim(v_building.farm_id::text), '') = p_farm_id::text
      or upper(nullif(btrim(v_building.farm_code), '')) = upper(nullif(btrim(v_farm.code), ''))
      or exists (
        select 1
        from jsonb_array_elements(
          case when jsonb_typeof(to_jsonb(v_farm.associated_warehouses)) = 'array'
            then to_jsonb(v_farm.associated_warehouses) else '[]'::jsonb end
        ) association
        where (association->>'id' ~ '^[0-9]+$' and (association->>'id')::bigint = v_building.id)
          or upper(nullif(btrim(association->>'whse_code'), '')) = upper(nullif(btrim(v_building.whse_code), ''))
      )
    ) then
    raise exception 'The selected building is not an active building of this farm.';
  end if;

  perform pg_advisory_xact_lock(73191, p_farm_id::integer);
  perform pg_advisory_xact_lock(73192, p_building_whse_id::integer);

  if exists (
    select 1
    from public.flock_card card
    where card.farm_id = p_farm_id
      and card.building_whse_id = p_building_whse_id
      and card.void = '1'
      and card.status = 'Saved'
  ) then
    raise exception 'This building already has an open cycle. Close the open cycle before creating another one.';
  end if;

  if exists (
    select 1
    from public.flock_card card
    where card.farm_id = p_farm_id
      and card.building_whse_id = p_building_whse_id
      and card.void = '1'
      and card.start_date >= p_cycle_month
      and card.start_date < (p_cycle_month + interval '1 month')::date
  ) then
    raise exception 'This building already has a cycle in the selected month.';
  end if;

  select greatest(
    coalesce((select max(cycle.cycle_no) from public.doc_farm_cycles cycle where cycle.farm_id = p_farm_id), 0),
    coalesce((select max(card.cycle_no::bigint) from public.flock_card card
      where card.farm_id = p_farm_id and btrim(coalesce(card.cycle_no, '')) ~ '^[0-9]+$'), 0)
  ) + 1 into v_next_cycle;
  v_cycle_mask := to_char(p_cycle_month, 'MMYY') || lpad(v_next_cycle::text, 4, '0');

  insert into public.doc_farm_cycles(
    farm_id, cycle_no, cycle_mask, status, created_by
  ) values (
    p_farm_id, v_next_cycle, v_cycle_mask, 'Past Open', v_actor
  ) returning * into v_cycle;

  insert into public.flock_card(
    created_by, card_no,
    farm_id, farm_code, farm_name,
    building_whse_id, building_src, building_key, building_code, building_name,
    age, start_date, breed, cycle_no, farm_cycle_id, animal_qty, sex,
    status, extra, void
  ) values (
    v_actor, format('FLOCK-PAST-%s-%s', txid_current(), p_building_whse_id),
    p_farm_id, v_farm.code, v_farm.name,
    p_building_whse_id, 'WAREHOUSE', format('warehouse:%s', p_building_whse_id),
    v_building.whse_code, v_building.whse_name,
    least(greatest(v_today - p_cycle_month, 0), 45), p_cycle_month, 'Unknown',
    v_next_cycle::text, v_cycle.id, 0, 'unknown',
    'Saved', jsonb_build_object(
      'createdFrom', 'CYCLE_MASTER_PAST',
      'cycleMonth', to_char(p_cycle_month, 'YYYY-MM'),
      'cycleAsOfDate', v_today::text
    ), '1'
  ) returning id into v_flock_card_id;

  return jsonb_build_object(
    'farmCycleId', v_cycle.id,
    'flockCardId', v_flock_card_id,
    'cycleNumber', v_next_cycle,
    'cycleMask', v_cycle_mask
  );
end;
$$;

revoke all on function public.open_broiler_past_cycle(bigint, bigint, date) from public, anon;
grant execute on function public.open_broiler_past_cycle(bigint, bigint, date) to authenticated;

notify pgrst, 'reload schema';
commit;
