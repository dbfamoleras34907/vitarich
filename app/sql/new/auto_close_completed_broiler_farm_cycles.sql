-- Restore automatic Broiler farm-cycle closeout after the last participating
-- building posts Clean Up, then repair historical cycles that already satisfy
-- the same rule.

begin;

set local statement_timeout = '30s';

create or replace function public.close_completed_doc_farm_cycle(
  p_farm_cycle_id bigint
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_farm_id bigint;
  v_cycle_status text;
  v_closed_at timestamptz;
  v_closed_by uuid;
begin
  if p_farm_cycle_id is null then
    return;
  end if;

  select cycle.farm_id
  into v_farm_id
  from public.doc_farm_cycles cycle
  where cycle.id = p_farm_cycle_id;

  if not found then
    return;
  end if;

  -- Use the same farm-scoped lifecycle lock as cycle creation and manual
  -- Cycle Master actions.
  perform pg_advisory_xact_lock(73191, v_farm_id::integer);

  select cycle.status
  into v_cycle_status
  from public.doc_farm_cycles cycle
  where cycle.id = p_farm_cycle_id
  for update;

  if v_cycle_status not in ('Saved', 'Past Open') then
    return;
  end if;

  select
    max(coalesce(card.updated_at, card.created_at)),
    (
      select latest.updated_by
      from public.flock_card latest
      where latest.farm_cycle_id = p_farm_cycle_id
        and latest.void = '1'
        and latest.updated_by is not null
      order by coalesce(latest.updated_at, latest.created_at) desc nulls last,
               latest.id desc
      limit 1
    )
  into v_closed_at, v_closed_by
  from public.flock_card card
  where card.farm_cycle_id = p_farm_cycle_id
    and card.void = '1'
  having count(*) > 0
     and bool_and(
       card.status = 'Closed'
       and coalesce(card.extra->>'closed_by_doc_type', '') = 'BR_CLEANUP'
     );

  if not found then
    return;
  end if;

  update public.doc_farm_cycles cycle
  set status = 'Closed',
      closed_at = coalesce(cycle.closed_at, v_closed_at, now()),
      closed_by = coalesce(cycle.closed_by, auth.uid(), v_closed_by),
      updated_at = now(),
      updated_by = coalesce(auth.uid(), v_closed_by, cycle.updated_by)
  where cycle.id = p_farm_cycle_id
    and cycle.status in ('Saved', 'Past Open');
end;
$$;

revoke all on function public.close_completed_doc_farm_cycle(bigint) from public, anon;
grant execute on function public.close_completed_doc_farm_cycle(bigint) to authenticated, service_role;

create or replace function public.lock_doc_farm_cycle_before_flock_close()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_farm_id bigint;
begin
  if new.farm_cycle_id is not null
     and new.status = 'Closed'
     and old.status is distinct from 'Closed'
     and coalesce(new.extra->>'closed_by_doc_type', '') = 'BR_CLEANUP' then
    select cycle.farm_id
    into v_farm_id
    from public.doc_farm_cycles cycle
    where cycle.id = new.farm_cycle_id;

    if v_farm_id is not null then
      perform pg_advisory_xact_lock(73191, v_farm_id::integer);
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.lock_doc_farm_cycle_before_flock_close()
  from public, anon, authenticated;

drop trigger if exists lock_doc_farm_cycle_before_flock_close_trigger
  on public.flock_card;
create trigger lock_doc_farm_cycle_before_flock_close_trigger
before update of status on public.flock_card
for each row
when (
  new.farm_cycle_id is not null
  and new.status = 'Closed'
  and old.status is distinct from 'Closed'
)
execute function public.lock_doc_farm_cycle_before_flock_close();

create or replace function public.close_doc_farm_cycle_after_flock_close()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.farm_cycle_id is not null
     and new.status = 'Closed'
     and old.status is distinct from 'Closed'
     and coalesce(new.extra->>'closed_by_doc_type', '') = 'BR_CLEANUP' then
    perform public.close_completed_doc_farm_cycle(new.farm_cycle_id);
  end if;

  return new;
end;
$$;

revoke all on function public.close_doc_farm_cycle_after_flock_close()
  from public, anon, authenticated;

drop trigger if exists close_doc_farm_cycle_after_flock_close_trigger
  on public.flock_card;
create trigger close_doc_farm_cycle_after_flock_close_trigger
after update of status on public.flock_card
for each row
when (
  new.farm_cycle_id is not null
  and new.status = 'Closed'
  and old.status is distinct from 'Closed'
)
execute function public.close_doc_farm_cycle_after_flock_close();

-- One-time repair: the function applies the same strict completion contract,
-- so retries are safe and cycles with open/non-Clean-Up cards remain unchanged.
do $$
declare
  v_cycle_id bigint;
begin
  for v_cycle_id in
    select cycle.id
    from public.doc_farm_cycles cycle
    where cycle.status in ('Saved', 'Past Open')
    order by cycle.id
  loop
    perform public.close_completed_doc_farm_cycle(v_cycle_id);
  end loop;
end;
$$;

commit;
