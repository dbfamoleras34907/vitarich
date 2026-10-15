-- Decouple Growing edits from Posted Harvest documents and persist the
-- operator-confirmed age on each Harvest & Delivery allocation group.
-- Apply this file before app/sql/updated/save_br_delivery_transaction.sql.
begin;

alter table public.br_delivery_lines
  add column if not exists harvest_age integer null;

alter table public.br_delivery_lines
  drop constraint if exists br_delivery_lines_harvest_age_check;

alter table public.br_delivery_lines
  add constraint br_delivery_lines_harvest_age_check
  check (harvest_age is null or harvest_age >= 0);

-- Existing documents remain readable. Use the linked Growing age as the best
-- available historical snapshot where the building/cycle can be resolved.
update public.br_delivery_lines line
set harvest_age = (
  select growing.actual_age
  from public.br_delivery delivery
  join public.flock_card card
    on card.farm_id = delivery.farm_id
   and card.farm_cycle_id = delivery.farm_cycle_id
   and card.void = '1'
   and card.status in ('Saved', 'Closed')
  join public.brd_fc growing
    on growing.card_no = card.card_no
   and growing.farm_id = card.farm_id
   and growing.void = '1'
  where delivery.id = line.br_delivery_id
    and (
      card.building_whse_id = line.from_warehouse_id
      or upper(btrim(card.building_code)) = upper(btrim(line.from_warehouse_code))
    )
  order by growing.id desc
  limit 1
)
where line.harvest_age is null
  and exists (
    select 1
    from public.br_delivery delivery
    join public.flock_card card
      on card.farm_id = delivery.farm_id
     and card.farm_cycle_id = delivery.farm_cycle_id
     and card.void = '1'
     and card.status in ('Saved', 'Closed')
    join public.brd_fc growing
      on growing.card_no = card.card_no
     and growing.farm_id = card.farm_id
     and growing.void = '1'
     and growing.actual_age is not null
    where delivery.id = line.br_delivery_id
      and (
        card.building_whse_id = line.from_warehouse_id
        or upper(btrim(card.building_code)) = upper(btrim(line.from_warehouse_code))
      )
  );

-- Posted Harvest no longer makes Growing read-only. The read RPC remains in
-- place because full Growing reversal still checks downstream documents.
drop trigger if exists guard_growing_posted_harvest on public.brd_fc;
drop trigger if exists guard_growing_posted_harvest on public.brd_fc_line;
drop trigger if exists guard_growing_posted_harvest on public.brd_fc_ba;
drop function if exists public.guard_growing_posted_harvest();

drop trigger if exists lock_harvest_growing_writes on public.br_delivery;
drop function if exists public.lock_harvest_growing_writes();

create or replace function public.validate_br_delivery_actual_age()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_target_age integer := 0;
  v_invalid_building text;
  v_invalid_age integer;
begin
  select coalesce(settings.target_delivery_age, 0)
  into v_target_age
  from public.brd_dr_settings settings
  where settings.farm_id = new.farm_id
    and settings.void = '1'
  order by settings.created_at desc
  limit 1;

  v_target_age := coalesce(v_target_age, 0);

  select
    coalesce(
      nullif(btrim(line.from_warehouse_name), ''),
      nullif(btrim(line.from_warehouse_code), ''),
      'Harvest line ' || line.line_no
    ),
    line.harvest_age
  into v_invalid_building, v_invalid_age
  from public.br_delivery_lines line
  where line.br_delivery_id = new.id
    and line.void = '1'
    and (line.harvest_age is null or line.harvest_age < v_target_age)
  order by line.line_no
  limit 1;

  if v_invalid_building is not null then
    if v_invalid_age is null then
      raise exception '% requires a Harvest age before posting.', v_invalid_building;
    end if;
    raise exception '% has a Harvest age of %. Age must be at least %.',
      v_invalid_building, v_invalid_age, v_target_age;
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

notify pgrst, 'reload schema';

commit;
