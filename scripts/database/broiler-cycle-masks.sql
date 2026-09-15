-- Install as database owner after doc_farm_cycles.sql, before deploying the UI.
-- cycle_no and every inventory/batch reference retain their original identity.
-- Building masks are generated, including historical rows, during installation.
-- Farm history: preview, inspect missing dates, then apply:
-- select * from public.backfill_broiler_cycle_masks();
-- select * from public.backfill_broiler_cycle_masks(true);
begin;

create or replace function public.format_broiler_cycle_mask(p_cycle text, p_start date)
returns text language sql immutable strict set search_path = public
as $$
  select case when btrim(p_cycle) ~ '^[0-9]+$' then
    lpad(extract(month from p_start)::integer::text, 2, '0') ||
    right(extract(year from p_start)::integer::text, 2) ||
    lpad(coalesce(nullif(ltrim(btrim(p_cycle), '0'), ''), '0'),
      greatest(4, length(coalesce(nullif(ltrim(btrim(p_cycle), '0'), ''), '0'))), '0')
  end;
$$;

alter table public.flock_card add column if not exists cycle_mask text
  generated always as (public.format_broiler_cycle_mask(cycle_no, start_date)) stored;
alter table public.doc_farm_cycles add column if not exists cycle_mask text;
comment on column public.doc_farm_cycles.cycle_mask is
  'MMYY#### display only. MMYY uses earliest non-void linked flock_card.start_date. cycle_no remains authoritative.';

create or replace function public.set_doc_farm_cycle_mask()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  select public.format_broiler_cycle_mask(new.cycle_no::text, min(card.start_date))
    into new.cycle_mask
  from public.flock_card card
  where card.farm_cycle_id = new.id and card.farm_id = new.farm_id and card.void = '1';
  return new;
end;
$$;

drop trigger if exists set_doc_farm_cycle_mask on public.doc_farm_cycles;
create trigger set_doc_farm_cycle_mask
before insert or update of cycle_no, farm_id, cycle_mask on public.doc_farm_cycles
for each row execute function public.set_doc_farm_cycle_mask();

create or replace function public.refresh_doc_farm_cycle_mask()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_old_id bigint;
  v_new_id bigint;
  v_id bigint;
begin
  if tg_op <> 'INSERT' then v_old_id := old.farm_cycle_id; end if;
  if tg_op <> 'DELETE' then v_new_id := new.farm_cycle_id; end if;
  -- Lock in a consistent order when moving a building between farm cycles.
  for v_id in select id from public.doc_farm_cycles
    where id in (v_old_id, v_new_id) order by id for update
  loop
    update public.doc_farm_cycles set cycle_mask = null where id = v_id;
  end loop;
  return null;
end;
$$;

drop trigger if exists refresh_doc_farm_cycle_mask on public.flock_card;
create trigger refresh_doc_farm_cycle_mask
after insert or delete or update of start_date, farm_cycle_id, farm_id, void on public.flock_card
for each row execute function public.refresh_doc_farm_cycle_mask();

create or replace function public.backfill_broiler_cycle_masks(p_apply boolean default false)
returns table(cycle_id bigint, farm_id bigint, cycle_no bigint, cycle_start date,
  previous_mask text, expected_mask text, result text)
language plpgsql set search_path = public
as $$
declare
  v_row record;
begin
  -- Owner-only maintenance, transactional, repeatable, and serialized with writes.
  lock table public.flock_card, public.doc_farm_cycles in share row exclusive mode;
  for v_row in
    select cycle.id, cycle.farm_id, cycle.cycle_no, cycle.cycle_mask,
      min(card.start_date) as start_date
    from public.doc_farm_cycles cycle
    left join public.flock_card card on card.farm_cycle_id = cycle.id
      and card.farm_id = cycle.farm_id and card.void = '1'
    group by cycle.id order by cycle.id
  loop
    cycle_id := v_row.id;
    farm_id := v_row.farm_id;
    cycle_no := v_row.cycle_no;
    cycle_start := v_row.start_date;
    previous_mask := v_row.cycle_mask;
    expected_mask := public.format_broiler_cycle_mask(cycle_no::text, cycle_start);
    result := case when cycle_start is null then 'missing_start_date'
      when previous_mask is not distinct from expected_mask then 'unchanged'
      when p_apply then 'updated' else 'pending' end;
    if p_apply and previous_mask is distinct from expected_mask then
      update public.doc_farm_cycles c set cycle_mask = expected_mask where c.id = cycle_id;
    end if;
    return next;
  end loop;
end;
$$;

revoke all on function public.backfill_broiler_cycle_masks(boolean) from public, anon, authenticated;
revoke all on function public.set_doc_farm_cycle_mask() from public, anon, authenticated;
revoke all on function public.refresh_doc_farm_cycle_mask() from public, anon, authenticated;
commit;
