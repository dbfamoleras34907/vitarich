-- Repair legacy Batch Number Series audit identities before deploying the
-- updated receiving_new_batch function from receiving_sources.sql.
--
-- created_by and updated_by are Auth user UUID snapshots. Older rows can
-- retain a UUID after the corresponding Auth user is removed, causing any
-- later series advance to fail its foreign-key check. Both fields are
-- nullable, so preserve valid identities and clear only orphaned values.

begin;
set local lock_timeout = '15s';

update public.batch_number_series series
set created_by = case
      when series.created_by is not null
        and not exists(select 1 from auth.users actor where actor.id=series.created_by)
      then null
      else series.created_by
    end,
    updated_by = case
      when series.updated_by is not null
        and not exists(select 1 from auth.users actor where actor.id=series.updated_by)
      then null
      else series.updated_by
    end
where (series.created_by is not null
    and not exists(select 1 from auth.users actor where actor.id=series.created_by))
   or (series.updated_by is not null
    and not exists(select 1 from auth.users actor where actor.id=series.updated_by));

do $$
begin
  if exists(
    select 1
    from public.batch_number_series series
    where (series.created_by is not null
        and not exists(select 1 from auth.users actor where actor.id=series.created_by))
       or (series.updated_by is not null
        and not exists(select 1 from auth.users actor where actor.id=series.updated_by))
  ) then
    raise exception 'Batch Number Series still contains orphaned Auth audit identities.';
  end if;
end
$$;

commit;
