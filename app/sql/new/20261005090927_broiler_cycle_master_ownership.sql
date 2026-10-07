-- Deploy after broiler_cycle_management.sql and scripts/database/broiler-cycle-masks.sql.
-- Every Broiler flock belongs to Cycle Master. Exclusion affects only the count.
-- No automatic backfill, renumbering, new flock cards, or inventory changes.
begin;

-- Keep the existing numeric sequence for ordering while preserving the exact
-- business Cycle Count used by legacy flock cards (for example, 150-01).
alter table public.doc_farm_cycles add column if not exists cycle_key text;
update public.doc_farm_cycles set cycle_key = cycle_no::text
where nullif(btrim(cycle_key), '') is null;
alter table public.doc_farm_cycles alter column cycle_key set not null;
create unique index if not exists doc_farm_cycles_farm_cycle_key_uidx
on public.doc_farm_cycles(farm_id, cycle_key);

create or replace function public.set_doc_farm_cycle_key()
returns trigger language plpgsql security invoker set search_path = public
as $$
begin
  new.cycle_key := coalesce(nullif(btrim(new.cycle_key), ''), new.cycle_no::text);
  return new;
end;
$$;
drop trigger if exists set_doc_farm_cycle_key on public.doc_farm_cycles;
create trigger set_doc_farm_cycle_key
before insert or update of cycle_no, cycle_key on public.doc_farm_cycles
for each row execute function public.set_doc_farm_cycle_key();
revoke all on function public.set_doc_farm_cycle_key() from public, anon, authenticated;

create or replace function public.set_doc_farm_cycle_mask()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if btrim(new.cycle_key) !~ '^[0-9]+$' then
    new.cycle_mask := new.cycle_key;
  else
    select public.format_broiler_cycle_mask(new.cycle_key, min(card.start_date))
      into new.cycle_mask
    from public.flock_card card
    where card.farm_cycle_id = new.id and card.farm_id = new.farm_id and card.void = '1';
  end if;
  return new;
end;
$$;
revoke all on function public.set_doc_farm_cycle_mask() from public, anon, authenticated;

create or replace function public.validate_doc_flock_cycle_assignment()
returns trigger language plpgsql security invoker set search_path = public
as $$
declare
  v_cycle public.doc_farm_cycles%rowtype;
  v_excluded boolean;
  v_assignment_changed boolean := true;
begin
  -- flock_card is the Broiler placement table; apply to every creation path,
  -- including Flock Information and Open Past Cycle, not just DOC_RECEIVING.
  if new.void <> '1' then return new; end if;
  if tg_op = 'UPDATE' then
    v_assignment_changed := new.farm_id is distinct from old.farm_id
      or new.building_whse_id is distinct from old.building_whse_id
      or new.farm_cycle_id is distinct from old.farm_cycle_id
      or new.cycle_no is distinct from old.cycle_no
      or old.void is distinct from '1';
    -- Allow completion/reversal of old history without silently creating owners.
    if not v_assignment_changed and new.status <> 'Saved' then return new; end if;
  end if;
  if new.farm_id is null or new.building_whse_id is null then
    raise exception 'A farm and building are required for Cycle Master ownership.';
  end if;
  perform pg_advisory_xact_lock(73191, new.farm_id::integer);
  if new.farm_cycle_id is null then
    raise exception 'Every building requires a Cycle Master link, including excluded buildings.';
  end if;
  select * into v_cycle from public.doc_farm_cycles c
  where c.id = new.farm_cycle_id and c.farm_id = new.farm_id;
  if not found then raise exception 'The Cycle Master does not belong to this farm.'; end if;
  if new.status = 'Saved' and v_cycle.status not in ('Saved', 'Past Open') then
    raise exception 'The selected Cycle Master is not open.';
  end if;
  if new.status = 'Saved' and exists (
    select 1 from public.flock_card c where c.farm_id = new.farm_id
      and c.building_whse_id = new.building_whse_id
      and c.void = '1' and c.status = 'Saved' and c.id is distinct from new.id
  ) then raise exception 'This building already has an active cycle. Use its existing flock card.'; end if;
  select exists(select 1 from public.doc_cycle_excluded_buildings e
    where e.farm_id = new.farm_id and e.building_whse_id = new.building_whse_id) into v_excluded;
  if v_assignment_changed then
    if btrim(coalesce(new.cycle_no, '')) = '' then raise exception 'A Cycle Count is required.'; end if;
    if not v_excluded and new.cycle_no <> v_cycle.cycle_key then
      raise exception 'The building Cycle Count must match its Cycle Master.';
    end if;
    if exists(select 1 from public.flock_card c where c.farm_id = new.farm_id
      and c.building_whse_id = new.building_whse_id and c.void = '1'
      and c.id is distinct from new.id
      and (c.farm_cycle_id = new.farm_cycle_id or (v_excluded and c.cycle_no = new.cycle_no))) then
      raise exception 'This building already participated in this cycle.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_doc_flock_cycle_assignment_trigger on public.flock_card;
create trigger validate_doc_flock_cycle_assignment_trigger
before insert or update of farm_id, building_whse_id, cycle_no, farm_cycle_id, status, extra, void
on public.flock_card for each row execute function public.validate_doc_flock_cycle_assignment();
revoke all on function public.validate_doc_flock_cycle_assignment() from public, anon, authenticated;

-- A unique index makes simultaneous inserts safe even when RLS hides other cards.
-- Deployment fails transactionally if existing overlapping active cards require review.
create unique index if not exists flock_card_one_open_cycle_per_building_uidx
on public.flock_card(farm_id, building_whse_id)
where void = '1' and status = 'Saved';

-- Owner-only, explicitly selected repair. Preview is the default. No row IDs are
-- inferred from BD codes. Ambiguous/missing counts require operator review.
create or replace function public.repair_broiler_cycle_master_links(
  p_farm_id bigint,
  p_flock_card_ids bigint[],
  p_apply boolean default false
) returns table(flock_card_id bigint, master_cycle_no bigint, master_id bigint, result text)
language plpgsql security invoker set search_path = public
as $$
declare
  v_ids bigint[];
  v_cycle public.doc_farm_cycles%rowtype;
  v_count bigint;
  v_keys text[];
  v_key text;
  v_card record;
begin
  lock table public.flock_card, public.doc_farm_cycles in share row exclusive mode;
  perform pg_advisory_xact_lock(73191, p_farm_id::integer);
  select array_agg(distinct n) into v_ids from unnest(p_flock_card_ids) n where n is not null;
  if coalesce(cardinality(v_ids), 0) = 0 then raise exception 'Select the existing flock card IDs to repair.'; end if;
  if (select count(*) from public.flock_card c where c.id = any(v_ids)
    and c.farm_id = p_farm_id and c.status = 'Saved' and c.void = '1'
    and c.building_whse_id is not null and c.start_date is not null) <> cardinality(v_ids) then
    raise exception 'Every selected card must be an active dated building placement of this farm.';
  end if;
  if exists(select 1 from public.flock_card c where c.farm_id = p_farm_id
    and c.status = 'Saved' and c.void = '1' group by c.building_whse_id having count(*) > 1) then
    raise exception 'Resolve overlapping active building cards before repairing Cycle Master.';
  end if;
  if exists(select 1 from public.flock_card c where c.id = any(v_ids)
    and not exists(select 1 from public.doc_cycle_excluded_buildings e
      where e.farm_id = p_farm_id and e.building_whse_id = c.building_whse_id)
    and (btrim(coalesce(c.cycle_no, '')) = ''
      or length(btrim(coalesce(c.cycle_no, ''))) > 100)) then
    raise exception 'A selected regular building has a missing or invalid count. Review its batch identity before repair; no data changed.';
  end if;
  select array_agg(distinct btrim(c.cycle_no)) into v_keys
  from public.flock_card c where c.id = any(v_ids)
    and not exists(select 1 from public.doc_cycle_excluded_buildings e
      where e.farm_id = p_farm_id and e.building_whse_id = c.building_whse_id);
  if cardinality(v_keys) > 1 then
    raise exception 'Selected regular buildings do not share one Cycle Count; no data changed.';
  end if;
  v_key := v_keys[1];
  select * into v_cycle from public.doc_farm_cycles c
    where c.farm_id = p_farm_id and c.status = 'Saved';
  if v_cycle.id is not null and v_key is not null and v_cycle.cycle_key <> v_key then
    raise exception 'Existing current Cycle Master conflicts with the selected building counts.';
  end if;
  if exists(select 1 from public.flock_card c where c.id = any(v_ids)
    and c.farm_cycle_id is not null and c.farm_cycle_id is distinct from v_cycle.id) then
    raise exception 'A selected card already belongs to another master; no data changed.';
  end if;
  if v_cycle.id is not null then
    v_count := v_cycle.cycle_no;
    v_key := coalesce(v_key, v_cycle.cycle_key);
  elsif v_key is not null then
    select case
      when v_key ~ '^[0-9]{1,18}$' and v_key::numeric between 1 and 9223372036854775807
        then v_key::bigint
      else greatest(
        coalesce((select max(c.cycle_no) from public.doc_farm_cycles c where c.farm_id = p_farm_id), 0),
        coalesce((select max(btrim(c.cycle_no)::bigint) from public.flock_card c
          where c.farm_id = p_farm_id and btrim(coalesce(c.cycle_no, '')) ~ '^[0-9]{1,18}$'
            and btrim(c.cycle_no)::numeric between 1 and 9223372036854775807), 0)
      ) + 1 end into v_count;
  end if;
  if v_count is null or v_key is null then
    raise exception 'Excluded buildings need an existing current Cycle Master before repair.';
  end if;
  if v_cycle.id is null and exists(select 1 from public.doc_farm_cycles c
    where c.farm_id = p_farm_id and (c.cycle_no = v_count or c.cycle_key = v_key)) then
    raise exception 'This count already belongs to a historical master. Review its state first.';
  end if;
  -- Also reject partial repairs of other active, unlinked regular building counts.
  if exists(select 1 from public.flock_card c where c.farm_id = p_farm_id
    and c.void = '1' and c.status = 'Saved' and c.farm_cycle_id is null
    and not (c.id = any(v_ids))) then
    raise exception 'Include all active unlinked cards of this farm in the repair preview.';
  end if;
  if p_apply then
    if v_cycle.id is null then
      insert into public.doc_farm_cycles(farm_id, cycle_no, cycle_key, status, created_at)
      select p_farm_id, v_count, v_key, 'Saved', min(c.created_at)
      from public.flock_card c where c.id = any(v_ids)
      returning * into v_cycle;
    end if;
    update public.flock_card c set farm_cycle_id = v_cycle.id
      where c.id = any(v_ids) and c.farm_cycle_id is null;
    -- Refresh using the installed display-mask trigger; never rewrite cycle_no.
    update public.doc_farm_cycles c set cycle_mask = null where c.id = v_cycle.id;
  end if;
  for v_card in select c.id, c.farm_cycle_id from public.flock_card c where c.id = any(v_ids) order by c.id loop
    flock_card_id := v_card.id; master_cycle_no := v_count;
    master_id := v_cycle.id;
    result := case when p_apply then 'linked' when v_card.farm_cycle_id = v_cycle.id then 'unchanged' else 'pending' end;
    return next;
  end loop;
end;
$$;
revoke all on function public.repair_broiler_cycle_master_links(bigint, bigint[], boolean)
from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
