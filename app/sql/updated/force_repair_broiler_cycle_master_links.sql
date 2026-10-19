-- Owner-only maintenance for explicitly selected active, unlinked Broiler
-- placements. Unlike repair_broiler_cycle_master_links, this routine supports
-- more than one Cycle Count in one call and never treats the internal numeric
-- doc_farm_cycles.cycle_no as the business Cycle Count.
--
-- Preview first (p_apply defaults to false), then repeat with p_apply = true.
-- Missing masters are created as Past Open so they cannot replace the farm's
-- Current Cycle. Exact closed cycle_key matches are reopened as Past Open.
begin;

create or replace function public.force_repair_broiler_cycle_master_links(
  p_farm_id bigint,
  p_flock_card_ids bigint[],
  p_apply boolean default false
) returns table(
  flock_card_id bigint,
  cycle_count text,
  master_cycle_no bigint,
  master_id bigint,
  master_status text,
  result text
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ids bigint[];
  v_key text;
  v_cycle public.doc_farm_cycles%rowtype;
  v_next_cycle_no bigint;
  v_card record;
begin
  if p_farm_id is null then
    raise exception 'Select a valid farm.';
  end if;

  select array_agg(distinct selected.selected_id order by selected.selected_id)
  into v_ids
  from unnest(p_flock_card_ids) as selected(selected_id)
  where selected.selected_id is not null;

  if coalesce(cardinality(v_ids), 0) = 0 then
    raise exception 'Select the existing flock card IDs to force repair.';
  end if;

  lock table public.flock_card, public.doc_farm_cycles in share row exclusive mode;
  perform pg_advisory_xact_lock(73191, p_farm_id::integer);

  if (
    select count(*)
    from public.flock_card card
    where card.id = any(v_ids)
      and card.farm_id = p_farm_id
      and card.status = 'Saved'
      and card.void = '1'
      and card.building_whse_id is not null
      and card.start_date is not null
  ) <> cardinality(v_ids) then
    raise exception 'Every selected card must be an active dated building placement of this farm.';
  end if;

  if exists (
    select 1
    from public.flock_card card
    where card.id = any(v_ids)
      and (
        nullif(btrim(card.cycle_no), '') is null
        or length(btrim(card.cycle_no)) > 100
      )
  ) then
    raise exception 'Every selected card must have a valid Cycle Count; no data changed.';
  end if;

  if exists (
    select 1
    from public.flock_card card
    where card.id = any(v_ids)
      and exists (
        select 1
        from public.doc_cycle_excluded_buildings excluded
        where excluded.farm_id = p_farm_id
          and excluded.building_whse_id = card.building_whse_id
      )
  ) then
    raise exception 'Excluded buildings need an explicit target Cycle Master and cannot use force repair.';
  end if;

  if exists (
    select 1
    from public.flock_card card
    join public.doc_farm_cycles linked_cycle on linked_cycle.id = card.farm_cycle_id
    where card.id = any(v_ids)
      and linked_cycle.farm_id is distinct from p_farm_id
  ) then
    raise exception 'A selected card is linked to a Cycle Master of another farm; no data changed.';
  end if;

  for v_key in
    select distinct btrim(card.cycle_no)
    from public.flock_card card
    where card.id = any(v_ids)
    order by btrim(card.cycle_no)
  loop
    select cycle.*
    into v_cycle
    from public.doc_farm_cycles cycle
    where cycle.farm_id = p_farm_id
      and cycle.cycle_key = v_key;

    if v_cycle.id is not null and v_cycle.status = 'Cancelled' then
      raise exception 'Cycle Count % belongs to a Cancelled Cycle Master; no data changed.', v_key;
    end if;

    if exists (
      select 1
      from public.flock_card card
      where card.id = any(v_ids)
        and btrim(card.cycle_no) = v_key
        and card.farm_cycle_id is not null
        and card.farm_cycle_id is distinct from v_cycle.id
    ) then
      raise exception 'A selected card for Cycle Count % already belongs to another master; no data changed.', v_key;
    end if;

    if p_apply then
      if v_cycle.id is null then
        select coalesce(max(cycle.cycle_no), 0) + 1
        into v_next_cycle_no
        from public.doc_farm_cycles cycle
        where cycle.farm_id = p_farm_id;

        insert into public.doc_farm_cycles (
          farm_id,
          cycle_no,
          cycle_key,
          status,
          created_at
        )
        select
          p_farm_id,
          v_next_cycle_no,
          v_key,
          'Past Open',
          min(card.created_at)
        from public.flock_card card
        where card.id = any(v_ids)
          and btrim(card.cycle_no) = v_key
        returning * into v_cycle;
      elsif v_cycle.status in ('Closed', 'Force Closed') then
        update public.doc_farm_cycles cycle
        set status = 'Past Open',
            reopened_at = now(),
            reopened_by = auth.uid(),
            updated_at = now(),
            updated_by = auth.uid()
        where cycle.id = v_cycle.id
        returning * into v_cycle;
      elsif v_cycle.status not in ('Saved', 'Past Open') then
        raise exception 'Cycle Count % has unsupported status %; no data changed.', v_key, v_cycle.status;
      end if;

      update public.flock_card card
      set farm_cycle_id = v_cycle.id
      where card.id = any(v_ids)
        and btrim(card.cycle_no) = v_key
        and card.farm_cycle_id is null;

      -- Refresh through the installed display-mask trigger after membership is
      -- present. This does not rewrite the placement's Cycle Count.
      update public.doc_farm_cycles cycle
      set cycle_mask = null
      where cycle.id = v_cycle.id;
    end if;

    for v_card in
      select card.id, card.farm_cycle_id
      from public.flock_card card
      where card.id = any(v_ids)
        and btrim(card.cycle_no) = v_key
      order by card.id
    loop
      flock_card_id := v_card.id;
      cycle_count := v_key;
      master_cycle_no := v_cycle.cycle_no;
      master_id := v_cycle.id;
      master_status := case
        when p_apply then v_cycle.status
        when v_cycle.id is null then 'Past Open'
        when v_cycle.status in ('Closed', 'Force Closed') then 'Past Open'
        else v_cycle.status
      end;
      result := case
        when not p_apply and v_cycle.id is null then 'would_create_past_open'
        when not p_apply and v_cycle.status in ('Closed', 'Force Closed') then 'would_reopen_and_link'
        when not p_apply and v_card.farm_cycle_id = v_cycle.id then 'unchanged'
        when not p_apply then 'would_link'
        when v_card.farm_cycle_id = v_cycle.id then 'linked'
        else 'unchanged'
      end;
      return next;
    end loop;
  end loop;
end;
$$;

revoke all on function public.force_repair_broiler_cycle_master_links(bigint, bigint[], boolean)
from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
