-- One-time, idempotent migration for historical Cycle Master records.
--
-- Historical flock cards created before doc_farm_cycles have no farm_cycle_id.
-- Reconstruct only completed histories here. Active/Saved flock cards remain
-- untouched because assigning them can change the live farm-cycle lifecycle.
--
-- The confirmed historical identity is:
--   public.flock_card.farm_id + numeric public.flock_card.cycle_no
--
-- This migration does not update Delivery, Clean Up, inventory postings,
-- document statuses, or the existing flock-card audit timestamps.

begin;

lock table public.doc_farm_cycles in share row exclusive mode;
lock table public.flock_card in share row exclusive mode;

with historical_cards as (
  select
    card.id,
    card.farm_id,
    trim(card.cycle_no)::numeric::bigint as cycle_no,
    card.status,
    card.created_at,
    card.updated_at
  from public.flock_card card
  where card.farm_cycle_id is null
    and card.farm_id is not null
    and card.status in ('Closed', 'Cancelled')
    and trim(coalesce(card.cycle_no, '')) ~ '^[0-9]+$'
    and trim(card.cycle_no)::numeric between 1 and 9223372036854775807
), historical_cycles as (
  select
    card.farm_id,
    card.cycle_no,
    case
      when bool_or(card.status = 'Closed') then 'Closed'
      else 'Cancelled'
    end as status,
    min(card.created_at) as created_at,
    max(coalesce(card.updated_at, card.created_at)) as completed_at
  from historical_cards card
  group by card.farm_id, card.cycle_no
)
insert into public.doc_farm_cycles (
  farm_id,
  cycle_no,
  status,
  created_at,
  updated_at,
  closed_at
)
select
  cycle.farm_id,
  cycle.cycle_no,
  cycle.status,
  cycle.created_at,
  cycle.completed_at,
  case when cycle.status = 'Closed' then cycle.completed_at else null end
from historical_cycles cycle
on conflict (farm_id, cycle_no) do nothing;

update public.flock_card card
set farm_cycle_id = cycle.id
from public.doc_farm_cycles cycle
where card.farm_cycle_id is null
  and card.farm_id = cycle.farm_id
  and card.status in ('Closed', 'Cancelled')
  and trim(coalesce(card.cycle_no, '')) ~ '^[0-9]+$'
  and trim(card.cycle_no)::numeric between 1 and 9223372036854775807
  and trim(card.cycle_no)::numeric::bigint = cycle.cycle_no;

do $$
begin
  if exists (
    select 1
    from public.flock_card card
    where card.farm_cycle_id is null
      and card.farm_id is not null
      and card.status in ('Closed', 'Cancelled')
      and trim(coalesce(card.cycle_no, '')) ~ '^[0-9]+$'
      and trim(card.cycle_no)::numeric between 1 and 9223372036854775807
  ) then
    raise exception 'Historical Cycle Master backfill left eligible flock cards unlinked.';
  end if;
end;
$$;

commit;

-- Verification: this should return zero rows after the migration.
select
  card.id,
  card.farm_id,
  card.cycle_no,
  card.status
from public.flock_card card
where card.farm_cycle_id is null
  and card.farm_id is not null
  and card.status in ('Closed', 'Cancelled')
  and trim(coalesce(card.cycle_no, '')) ~ '^[0-9]+$'
  and trim(card.cycle_no)::numeric between 1 and 9223372036854775807
order by card.farm_id, trim(card.cycle_no)::numeric, card.id;
