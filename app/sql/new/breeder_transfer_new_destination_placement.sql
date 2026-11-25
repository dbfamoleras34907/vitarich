-- Creates an empty receiving placement when a breeder transfer moves birds to
-- a configured building/pen that has no active placement yet.
begin;

alter table public.tbl_placement
  add column if not exists age_anchor_date date;

create or replace function public.set_breeder_placement_age_anchor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Existing placements remain null and the application falls back to their
  -- placement_date. Do not backfill them: posted placements are intentionally
  -- locked against identity changes.
  new.age_anchor_date := coalesce(new.age_anchor_date, new.placement_date);
  return new;
end;
$$;

drop trigger if exists tbl_placement_age_anchor on public.tbl_placement;
create trigger tbl_placement_age_anchor
before insert or update of placement_date, age_anchor_date on public.tbl_placement
for each row execute function public.set_breeder_placement_age_anchor();

create or replace function public.post_breeder_transfer_to_new_destination(
  p_transfer_date date,
  p_source_placement_id bigint,
  p_destination_building_id bigint,
  p_destination_pen_id bigint,
  p_male_qty integer,
  p_female_qty integer,
  p_reason text,
  p_remarks text,
  p_user_id uuid
)
returns table (transfer_id bigint, destination_placement_id bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.tbl_placement%rowtype;
  v_location record;
  v_cycle_id bigint;
  v_cycle_no integer;
  v_destination_placement_id bigint;
  v_transfer_id bigint;
  v_today date := timezone('Asia/Manila', now())::date;
begin
  if p_transfer_date is null or p_transfer_date > v_today then
    raise exception 'Transfer date cannot be later than today.';
  end if;
  if p_source_placement_id is null or p_destination_building_id is null or p_destination_pen_id is null then
    raise exception 'A source, destination building, and destination pen are required.';
  end if;
  if coalesce(p_male_qty, 0) < 0 or coalesce(p_female_qty, 0) < 0
    or coalesce(p_male_qty, 0) + coalesce(p_female_qty, 0) <= 0 then
    raise exception 'Enter a positive whole-number male or female quantity.';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'Transfer reason is required.';
  end if;

  select * into v_source
  from public.tbl_placement
  where id = p_source_placement_id
  for update;
  if not found then
    raise exception 'Source placement was not found.';
  end if;
  if p_transfer_date < v_source.placement_date then
    raise exception 'Transfer date cannot be earlier than the source placement date.';
  end if;
  if not exists (
    select 1
    from public.tbl_breeder_cycle source_cycle
    where source_cycle.id = v_source.cycle_id
      and lower(coalesce(source_cycle.status, '')) = 'active'
  ) then
    raise exception 'The source placement does not have an active breeder cycle.';
  end if;

  select farm_id, building_id, building_name, pen_id, pen_name
  into v_location
  from public.view_farm_new_lookup
  where farm_id = v_source.farm_id
    and building_id = p_destination_building_id
    and pen_id = p_destination_pen_id
  limit 1;
  if not found then
    raise exception 'Destination building and pen must belong to the source farm.';
  end if;
  if v_source.building_id = p_destination_building_id and v_source.pen_id = p_destination_pen_id then
    raise exception 'Source and destination cannot be the same pen.';
  end if;

  perform pg_advisory_xact_lock(hashtext(format('breeder-destination:%s:%s:%s', v_source.farm_id, p_destination_building_id, p_destination_pen_id)));
  if exists (
    select 1
    from public.tbl_breeder_cycle destination_cycle
    where destination_cycle.farm_id = v_source.farm_id
      and destination_cycle.building_id = p_destination_building_id
      and destination_cycle.pen_id = p_destination_pen_id
      and lower(coalesce(destination_cycle.status, '')) = 'active'
  ) then
    raise exception 'The destination pen already has an active cycle. Select its active Population Record instead.';
  end if;

  select coalesce(max(cycle_no), 0) + 1
  into v_cycle_no
  from public.tbl_breeder_cycle
  where farm_id = v_source.farm_id
    and building_id = p_destination_building_id
    and pen_id = p_destination_pen_id;

  insert into public.tbl_breeder_cycle (
    farm_id, building_id, pen_id, cycle_no, status
  ) values (
    v_source.farm_id, p_destination_building_id, p_destination_pen_id, v_cycle_no, 'Active'
  ) returning id into v_cycle_id;

  insert into public.tbl_placement (
    placement_date, age_anchor_date, dr_no, file_attached,
    farm_id, building_id, pen_id, farm_name, building_no, pen_no,
    f_source, f_beg, f_doa, f_reject, f_shortcount, f_remarks, f_avg_bodyw,
    m_source, m_beg, m_doa, m_reject, m_shortcount, m_remarks, m_avg_bodyw,
    remarks, cycle_id
  ) values (
    v_source.placement_date, coalesce(v_source.age_anchor_date, v_source.placement_date), '', null,
    v_source.farm_id, p_destination_building_id, p_destination_pen_id,
    v_source.farm_name, v_location.building_name, v_location.pen_name,
    v_source.f_source, 0, 0, 0, 0, v_source.f_remarks, v_source.f_avg_bodyw,
    v_source.m_source, 0, 0, 0, 0, v_source.m_remarks, v_source.m_avg_bodyw,
    concat('Created by transfer from placement #', v_source.id), v_cycle_id
  ) returning id into v_destination_placement_id;

  insert into public.tbl_breeder_transfer (
    transfer_no, transfer_date, source_placement_id, destination_placement_id,
    male_qty, female_qty, reason, remarks, status, created_by
  ) values (
    'BTR-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(md5(random()::text), 1, 4)),
    p_transfer_date, v_source.id, v_destination_placement_id,
    p_male_qty, p_female_qty, btrim(p_reason), nullif(btrim(p_remarks), ''), 'Draft', p_user_id
  ) returning id into v_transfer_id;

  -- The existing posting function remains the authoritative writer of the
  -- paired Transfer Out and Transfer In daily-performance entries.
  perform public.post_breeder_transfer(v_transfer_id, p_user_id);

  return query select v_transfer_id, v_destination_placement_id;
end;
$$;

revoke all on function public.post_breeder_transfer_to_new_destination(date, bigint, bigint, bigint, integer, integer, text, text, uuid) from public, anon;
grant execute on function public.post_breeder_transfer_to_new_destination(date, bigint, bigint, bigint, integer, integer, text, text, uuid) to authenticated;

commit;
