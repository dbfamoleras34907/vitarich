-- Automatically link a placement to a breeder cycle.
-- For a farm/building/pen with no cycle history, the first cycle is Cycle 1.

create unique index if not exists uq_tbl_breeder_cycle_location_cycle_no
  on public.tbl_breeder_cycle (farm_id, building_id, pen_id, cycle_no);

create or replace function public.assign_breeder_cycle_to_placement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle_id bigint;
begin
  -- Preserve an explicitly selected cycle when it belongs to this location.
  if new.cycle_id is not null then
    select cycle.id
      into v_cycle_id
      from public.tbl_breeder_cycle cycle
     where cycle.id = new.cycle_id
       and cycle.farm_id = new.farm_id
       and cycle.building_id = new.building_id
       and cycle.pen_id = new.pen_id;

    if v_cycle_id is not null then
      return new;
    end if;
  end if;

  -- Prefer the current active cycle for this exact farm/building/pen.
  select cycle.id
    into v_cycle_id
    from public.tbl_breeder_cycle cycle
   where cycle.farm_id = new.farm_id
     and cycle.building_id = new.building_id
     and cycle.pen_id = new.pen_id
     and lower(cycle.status) = 'active'
   order by cycle.cycle_no desc, cycle.id desc
   limit 1;

  -- If the location has cycle history but none is active, retain its latest cycle.
  if v_cycle_id is null then
    select cycle.id
      into v_cycle_id
      from public.tbl_breeder_cycle cycle
     where cycle.farm_id = new.farm_id
       and cycle.building_id = new.building_id
       and cycle.pen_id = new.pen_id
     order by cycle.cycle_no desc, cycle.id desc
     limit 1;
  end if;

  -- A location with no cycle history always starts at Cycle 1.
  if v_cycle_id is null then
    insert into public.tbl_breeder_cycle (
      farm_id,
      building_id,
      pen_id,
      cycle_no,
      status
    )
    values (
      new.farm_id,
      new.building_id,
      new.pen_id,
      1,
      'Active'
    )
    on conflict (farm_id, building_id, pen_id, cycle_no)
    do update set cycle_no = excluded.cycle_no
    returning id into v_cycle_id;
  end if;

  new.cycle_id := v_cycle_id;
  return new;
end;
$$;

drop trigger if exists assign_breeder_cycle_to_placement_trigger
  on public.tbl_placement;

create trigger assign_breeder_cycle_to_placement_trigger
before insert or update
on public.tbl_placement
for each row
execute function public.assign_breeder_cycle_to_placement();
