\set ON_ERROR_STOP on

\ir fixture.sql
\ir '../../../../app/sql/new/auto_close_completed_broiler_farm_cycles.sql'

do $$
begin
  if (select status from public.doc_farm_cycles where id = 1) <> 'Saved' then
    raise exception 'Incomplete cycle closed during repair.';
  end if;
  if (select status from public.doc_farm_cycles where id = 2) <> 'Closed' then
    raise exception 'Completed historical cycle was not repaired.';
  end if;
  if (select closed_at from public.doc_farm_cycles where id = 2) <> '2026-09-01 03:00:00+00'::timestamptz then
    raise exception 'Historical repair did not retain the latest building close timestamp.';
  end if;
  if (select closed_by from public.doc_farm_cycles where id = 2) <> '22222222-2222-2222-2222-222222222222'::uuid then
    raise exception 'Historical repair did not retain the latest building actor.';
  end if;
  if (select status from public.doc_farm_cycles where id = 3) <> 'Saved' then
    raise exception 'Cycle without participating buildings was closed.';
  end if;
  if (select status from public.doc_farm_cycles where id = 4) <> 'Saved' then
    raise exception 'Cycle without complete Clean Up evidence was closed.';
  end if;
  if (select status from public.doc_farm_cycles where id = 5) <> 'Closed' then
    raise exception 'Completed Past Open cycle was not repaired.';
  end if;
  if (select status from public.doc_farm_cycles where id = 6) <> 'Closed' then
    raise exception 'Voided Flock Card incorrectly blocked cycle completion.';
  end if;
end;
$$;

set test.auth_uid = '33333333-3333-3333-3333-333333333333';
set role authenticated;

update public.flock_card
set status = 'Closed',
    extra = '{"closed_by_doc_type":"BR_CLEANUP"}',
    updated_at = '2026-10-01 04:00:00+00',
    updated_by = auth.uid()
where id = 12;

reset role;

do $$
begin
  if (select status from public.doc_farm_cycles where id = 1) <> 'Closed' then
    raise exception 'Final posted Clean Up did not close the cycle.';
  end if;
  if (select closed_at from public.doc_farm_cycles where id = 1) <> '2026-10-01 04:00:00+00'::timestamptz then
    raise exception 'Automatic close timestamp is incorrect.';
  end if;
  if (select closed_by from public.doc_farm_cycles where id = 1) <> '33333333-3333-3333-3333-333333333333'::uuid then
    raise exception 'Automatic close actor is incorrect.';
  end if;
end;
$$;

-- Deployment is idempotent and does not alter already-closed cycle metadata.
create temp table closed_snapshot as
select id, status, closed_at, closed_by
from public.doc_farm_cycles
where status = 'Closed';

\ir '../../../../app/sql/new/auto_close_completed_broiler_farm_cycles.sql'

do $$
begin
  if exists (
    select 1
    from public.doc_farm_cycles cycle
    join closed_snapshot snapshot using (id)
    where (cycle.status, cycle.closed_at, cycle.closed_by)
      is distinct from (snapshot.status, snapshot.closed_at, snapshot.closed_by)
  ) then
    raise exception 'Idempotent deployment changed closed cycle metadata.';
  end if;
end;
$$;

select 'Broiler cycle auto-close SQL checks passed' as result;
