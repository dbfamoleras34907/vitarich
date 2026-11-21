-- Shared authoritative breeder live-bird inventory.
-- Apply after breeder_inventory_corrections.sql and breeder_transfer_transactions.sql.
begin;

-- A correction is an opening-balance adjustment: it applies from placement
-- date, not merely from the date it was encoded.
create or replace function public.get_breeder_available_inventory(
  p_placement_id bigint,
  p_as_of_date date,
  p_include_as_of_date boolean default true
)
returns table (male_available bigint, female_available bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_male bigint;
  v_base_female bigint;
  v_correction_male bigint;
  v_correction_female bigint;
  v_movement_male bigint;
  v_movement_female bigint;
begin
  if p_placement_id is null or p_placement_id <= 0 or p_as_of_date is null then
    raise exception 'A placement and as-of date are required.';
  end if;

  select
    coalesce(placement.m_endingbalance,
      coalesce(placement.m_beg, 0) - coalesce(placement.m_doa, 0)
      - coalesce(placement.m_reject, 0) - coalesce(placement.m_shortcount, 0))::bigint,
    coalesce(placement.f_endingbalance,
      coalesce(placement.f_beg, 0) - coalesce(placement.f_doa, 0)
      - coalesce(placement.f_reject, 0) - coalesce(placement.f_shortcount, 0))::bigint
  into v_base_male, v_base_female
  from public.tbl_placement placement
  where placement.id = p_placement_id;
  if not found then
    raise exception 'Breeder inventory requires a valid placement.';
  end if;

  select
    coalesce(sum(coalesce(correction.male_delta, 0)), 0)::bigint,
    coalesce(sum(coalesce(correction.female_delta, 0)), 0)::bigint
  into v_correction_male, v_correction_female
  from public.tbl_breeder_inventory_correction correction
  where correction.placement_id = p_placement_id
    and correction.status = 'Posted';

  select
    coalesce(sum(coalesce(performance.trans_in_male, 0) - coalesce(performance.mc_male, 0)
      - coalesce(performance.cull_male, 0) - coalesce(performance.trans_out_male, 0)
      - coalesce(performance.kitchen_male, 0) - coalesce(performance.condem_male, 0)), 0)::bigint,
    coalesce(sum(coalesce(performance.trans_in_female, 0) - coalesce(performance.mc_female, 0)
      - coalesce(performance.cull_female, 0) - coalesce(performance.trans_out_female, 0)
      - coalesce(performance.kitchen_female, 0) - coalesce(performance.condem_female, 0)), 0)::bigint
  into v_movement_male, v_movement_female
  from public.tbl_breeder_daily_performance performance
  where performance.placement_id = p_placement_id
    and performance.isactive = true
    and (performance.daterec < p_as_of_date
      or (p_include_as_of_date and performance.daterec = p_as_of_date));

  return query select
    v_base_male + v_correction_male + v_movement_male,
    v_base_female + v_correction_female + v_movement_female;
end;
$$;

-- Rebuilds stored daily openings and rejects any correction or backdated
-- movement that would leave a historic day below zero.
create or replace function public.rebuild_breeder_daily_inventory(p_placement_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_placement_id is null or p_placement_id <= 0 then
    raise exception 'A placement is required.';
  end if;

  if exists (
    select 1
    from public.tbl_breeder_daily_performance performance
    cross join lateral public.get_breeder_available_inventory(
      performance.placement_id, performance.daterec, false
    ) available
    where performance.placement_id = p_placement_id
      and performance.isactive = true
      and (
        available.male_available + coalesce(performance.trans_in_male, 0)
          - coalesce(performance.mc_male, 0) - coalesce(performance.cull_male, 0)
          - coalesce(performance.trans_out_male, 0) - coalesce(performance.kitchen_male, 0)
          - coalesce(performance.condem_male, 0) < 0
        or available.female_available + coalesce(performance.trans_in_female, 0)
          - coalesce(performance.mc_female, 0) - coalesce(performance.cull_female, 0)
          - coalesce(performance.trans_out_female, 0) - coalesce(performance.kitchen_female, 0)
          - coalesce(performance.condem_female, 0) < 0
      )
  ) then
    raise exception 'Inventory correction or Population Record movement would make breeder inventory negative.';
  end if;

  perform set_config('app.breeder_inventory_rebuild', '1', true);
  with calculated as (
    select performance.id, available.male_available, available.female_available
    from public.tbl_breeder_daily_performance performance
    cross join lateral public.get_breeder_available_inventory(
      performance.placement_id, performance.daterec, false
    ) available
    where performance.placement_id = p_placement_id
      and performance.isactive = true
  )
  update public.tbl_breeder_daily_performance performance
  set inv_male = calculated.male_available,
      inv_female = calculated.female_available
  from calculated
  where performance.id = calculated.id;
end;
$$;

create or replace function public.sync_breeder_daily_performance_opening_inventory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_male bigint;
  v_female bigint;
begin
  if current_setting('app.breeder_inventory_rebuild', true) = '1' then
    return new;
  end if;

  perform 1 from public.tbl_placement placement
  where placement.id = new.placement_id
  for update;
  if not found then
    raise exception 'Breeder daily performance requires a valid placement.';
  end if;

  select male_available, female_available
  into v_male, v_female
  from public.get_breeder_available_inventory(new.placement_id, new.daterec, false);
  new.inv_male := v_male;
  new.inv_female := v_female;
  return new;
end;
$$;

create or replace function public.rebuild_breeder_daily_inventory_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('app.breeder_inventory_rebuild', true), '0') <> '1'
     and coalesce(current_setting('app.breeder_inventory_defer_rebuild', true), '0') <> '1' then
    perform public.rebuild_breeder_daily_inventory(new.placement_id);
  end if;
  return new;
end;
$$;

create or replace function public.rebuild_breeder_inventory_after_correction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.tbl_placement placement
    join public.tbl_breeder_cycle cycle on cycle.id = placement.cycle_id
    where placement.id = new.placement_id
      and lower(coalesce(cycle.status, '')) <> 'active'
  ) then
    raise exception 'Inventory correction is not allowed after the breeder cycle is closed.';
  end if;
  perform public.rebuild_breeder_daily_inventory(new.placement_id);
  return new;
end;
$$;

drop trigger if exists tbl_breeder_daily_performance_opening_inventory
  on public.tbl_breeder_daily_performance;
create trigger tbl_breeder_daily_performance_opening_inventory
before insert or update of
  placement_id, daterec, inv_male, inv_female,
  mc_male, mc_female, cull_male, cull_female,
  trans_in_male, trans_in_female, trans_out_male, trans_out_female,
  kitchen_male, kitchen_female, condem_male, condem_female, isactive
on public.tbl_breeder_daily_performance
for each row execute function public.sync_breeder_daily_performance_opening_inventory();

drop trigger if exists tbl_breeder_daily_performance_rebuild_inventory
  on public.tbl_breeder_daily_performance;
create trigger tbl_breeder_daily_performance_rebuild_inventory
after insert or update of
  placement_id, daterec, mc_male, mc_female, cull_male, cull_female,
  trans_in_male, trans_in_female, trans_out_male, trans_out_female,
  kitchen_male, kitchen_female, condem_male, condem_female, isactive
on public.tbl_breeder_daily_performance
for each row execute function public.rebuild_breeder_daily_inventory_after_write();

drop trigger if exists tbl_breeder_inventory_correction_rebuild_inventory
  on public.tbl_breeder_inventory_correction;
create trigger tbl_breeder_inventory_correction_rebuild_inventory
after insert or update of status, male_delta, female_delta
on public.tbl_breeder_inventory_correction
for each row execute function public.rebuild_breeder_inventory_after_correction();

-- Terminal Culling remains a separate closing document, but it validates its
-- quantities against the same placement inventory used by Transfer Out.
create or replace function public.validate_breeder_cleanup_inventory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_male_available bigint := 0;
  v_female_available bigint := 0;
  v_as_of_date date;
begin
  v_as_of_date := coalesce(new.date_of_culling, timezone('Asia/Manila', now())::date);
  select
    coalesce(sum(available.male_available), 0),
    coalesce(sum(available.female_available), 0)
  into v_male_available, v_female_available
  from public.tbl_placement placement
  cross join lateral public.get_breeder_available_inventory(
    placement.id, v_as_of_date, true
  ) available
  where placement.cycle_id = any(coalesce(new.cycle_ids, array[new.cycle_id]))
    and placement.placement_date <= v_as_of_date;

  if coalesce(new.male_cleanup_qty, 0) > v_male_available then
    raise exception 'Male Culling Qty cannot exceed the available inventory of %.', v_male_available;
  end if;
  if coalesce(new.female_cleanup_qty, 0) > v_female_available then
    raise exception 'Female Culling Qty cannot exceed the available inventory of %.', v_female_available;
  end if;
  return new;
end;
$$;

drop trigger if exists tbl_breeder_cleanup_validate_inventory
  on public.tbl_breeder_cleanup;
create trigger tbl_breeder_cleanup_validate_inventory
before insert or update of
  cycle_id, cycle_ids, date_of_culling, female_cleanup_qty, male_cleanup_qty
on public.tbl_breeder_cleanup
for each row execute function public.validate_breeder_cleanup_inventory();

-- The header, audit fields, and notification triggers remain unchanged.  This
-- replaces only the posting writer so server-side validation uses the shared
-- formula instead of a stale stored inv_* value.
create or replace function public.post_breeder_transfer(
  p_transfer_id bigint,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer public.tbl_breeder_transfer%rowtype;
  v_source public.tbl_placement%rowtype;
  v_destination public.tbl_placement%rowtype;
  v_male_available bigint;
  v_female_available bigint;
  v_source_daily_id bigint;
  v_destination_daily_id bigint;
begin
  if p_transfer_id is null or p_transfer_id <= 0 or p_user_id is null then
    raise exception 'A bird transfer and user are required.';
  end if;

  select * into v_transfer
  from public.tbl_breeder_transfer
  where id = p_transfer_id
  for update;
  if not found or v_transfer.status <> 'Draft' then
    raise exception 'Only a draft bird transfer can be posted.';
  end if;
  if v_transfer.transfer_date > timezone('Asia/Manila', now())::date then
    raise exception 'Transfer date cannot be later than today.';
  end if;
  if coalesce(v_transfer.male_qty, 0) < 0
     or coalesce(v_transfer.female_qty, 0) < 0
     or coalesce(v_transfer.male_qty, 0) + coalesce(v_transfer.female_qty, 0) <= 0 then
    raise exception 'Enter a positive whole-number male or female quantity.';
  end if;

  perform pg_advisory_xact_lock(least(v_transfer.source_placement_id, v_transfer.destination_placement_id));
  perform pg_advisory_xact_lock(greatest(v_transfer.source_placement_id, v_transfer.destination_placement_id));

  select * into v_source from public.tbl_placement
  where id = v_transfer.source_placement_id for update;
  select * into v_destination from public.tbl_placement
  where id = v_transfer.destination_placement_id for update;
  if v_source.id is null or v_destination.id is null then
    raise exception 'Transfer source and destination placements are required.';
  end if;
  if v_source.id = v_destination.id then
    raise exception 'Source and destination cannot be the same placement.';
  end if;
  if v_transfer.transfer_date < v_source.placement_date
     or v_transfer.transfer_date < v_destination.placement_date then
    raise exception 'Transfer date cannot be earlier than either placement date.';
  end if;
  if not exists (
    select 1 from public.tbl_breeder_cycle cycle
    where cycle.id = v_source.cycle_id and lower(coalesce(cycle.status, '')) = 'active'
  ) or not exists (
    select 1 from public.tbl_breeder_cycle cycle
    where cycle.id = v_destination.cycle_id and lower(coalesce(cycle.status, '')) = 'active'
  ) then
    raise exception 'Both transfer placements must have active breeder cycles.';
  end if;

  select male_available, female_available
  into v_male_available, v_female_available
  from public.get_breeder_available_inventory(v_source.id, v_transfer.transfer_date, true);
  if coalesce(v_transfer.male_qty, 0) > v_male_available then
    raise exception 'Male transfer quantity exceeds source inventory.';
  end if;
  if coalesce(v_transfer.female_qty, 0) > v_female_available then
    raise exception 'Female transfer quantity exceeds source inventory.';
  end if;

  perform set_config('app.breeder_inventory_defer_rebuild', '1', true);
  perform set_config('app.breeder_transfer_actor', p_user_id::text, true);

  select id into v_source_daily_id
  from public.tbl_breeder_daily_performance
  where placement_id = v_source.id and daterec = v_transfer.transfer_date and isactive = true
  order by id limit 1 for update;
  if v_source_daily_id is null then
    insert into public.tbl_breeder_daily_performance (
      placement_id, daterec, trans_out_male, trans_out_female, created_by
    ) values (
      v_source.id, v_transfer.transfer_date,
      coalesce(v_transfer.male_qty, 0), coalesce(v_transfer.female_qty, 0), p_user_id
    );
  else
    update public.tbl_breeder_daily_performance
    set trans_out_male = coalesce(trans_out_male, 0) + coalesce(v_transfer.male_qty, 0),
        trans_out_female = coalesce(trans_out_female, 0) + coalesce(v_transfer.female_qty, 0),
        updated_at = now(), updated_by = p_user_id
    where id = v_source_daily_id;
  end if;

  select id into v_destination_daily_id
  from public.tbl_breeder_daily_performance
  where placement_id = v_destination.id and daterec = v_transfer.transfer_date and isactive = true
  order by id limit 1 for update;
  if v_destination_daily_id is null then
    insert into public.tbl_breeder_daily_performance (
      placement_id, daterec, trans_in_male, trans_in_female, created_by
    ) values (
      v_destination.id, v_transfer.transfer_date,
      coalesce(v_transfer.male_qty, 0), coalesce(v_transfer.female_qty, 0), p_user_id
    );
  else
    update public.tbl_breeder_daily_performance
    set trans_in_male = coalesce(trans_in_male, 0) + coalesce(v_transfer.male_qty, 0),
        trans_in_female = coalesce(trans_in_female, 0) + coalesce(v_transfer.female_qty, 0),
        updated_at = now(), updated_by = p_user_id
    where id = v_destination_daily_id;
  end if;

  perform public.rebuild_breeder_daily_inventory(v_source.id);
  perform public.rebuild_breeder_daily_inventory(v_destination.id);

  update public.tbl_breeder_transfer
  set status = 'Posted', posted_by = p_user_id, posted_at = now(),
      updated_by = p_user_id, updated_at = now()
  where id = v_transfer.id;
end;
$$;

-- One-time controlled backfill for already-saved Population Records.
do $$
declare
  v_placement_id bigint;
begin
  for v_placement_id in
    select distinct placement_id
    from public.tbl_breeder_daily_performance
    where isactive = true
  loop
    perform public.rebuild_breeder_daily_inventory(v_placement_id);
  end loop;
end;
$$;

revoke all on function public.get_breeder_available_inventory(bigint, date, boolean) from public, anon;
grant execute on function public.get_breeder_available_inventory(bigint, date, boolean) to service_role;
revoke all on function public.rebuild_breeder_daily_inventory(bigint) from public, anon, authenticated;
revoke all on function public.sync_breeder_daily_performance_opening_inventory() from public, anon, authenticated;
revoke all on function public.rebuild_breeder_daily_inventory_after_write() from public, anon, authenticated;
revoke all on function public.rebuild_breeder_inventory_after_correction() from public, anon, authenticated;
revoke all on function public.validate_breeder_cleanup_inventory() from public, anon, authenticated;
revoke all on function public.post_breeder_transfer(bigint, uuid) from public, anon;
grant execute on function public.post_breeder_transfer(bigint, uuid) to service_role;
commit;
