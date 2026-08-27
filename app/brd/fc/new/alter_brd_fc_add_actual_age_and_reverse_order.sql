begin;

-- Keep the brd_fc AccessExclusiveLock in a short transaction. The previous
-- single-transaction migration could deadlock with live Growing saves that
-- update brd_fc and brd_fc_line in a different order.
alter table public.brd_fc
  add column if not exists actual_age integer null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'brd_fc_actual_age_check'
      and conrelid = 'public.brd_fc'::regclass
  ) then
    alter table public.brd_fc
      add constraint brd_fc_actual_age_check
      check (actual_age is null or actual_age >= 0)
      not valid;
  end if;
end;
$$;

commit;

begin;

create or replace function public.sync_brd_fc_actual_age()
returns trigger
language plpgsql
as $$
declare
  v_fc_id bigint;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_fc_id := old.fc_id;

    update public.brd_fc card
    set actual_age = (
      select max(line.age)
      from public.brd_fc_line line
      where line.fc_id = v_fc_id
        and line.void = '1'
        and coalesce(line.mort_am, 0) + coalesce(line.mort_pm, 0) > 0
    )
    where card.id = v_fc_id
      and card.actual_age is distinct from (
        select max(line.age)
        from public.brd_fc_line line
        where line.fc_id = v_fc_id
          and line.void = '1'
          and coalesce(line.mort_am, 0) + coalesce(line.mort_pm, 0) > 0
      );
  end if;

  if tg_op in ('INSERT', 'UPDATE')
    and (tg_op = 'INSERT' or new.fc_id is distinct from old.fc_id) then
    v_fc_id := new.fc_id;

    update public.brd_fc card
    set actual_age = (
      select max(line.age)
      from public.brd_fc_line line
      where line.fc_id = v_fc_id
        and line.void = '1'
        and coalesce(line.mort_am, 0) + coalesce(line.mort_pm, 0) > 0
    )
    where card.id = v_fc_id
      and card.actual_age is distinct from (
        select max(line.age)
        from public.brd_fc_line line
        where line.fc_id = v_fc_id
          and line.void = '1'
          and coalesce(line.mort_am, 0) + coalesce(line.mort_pm, 0) > 0
      );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_brd_fc_actual_age_on_line on public.brd_fc_line;
create trigger sync_brd_fc_actual_age_on_line
after insert or delete or update of fc_id, age, mort_am, mort_pm, void on public.brd_fc_line
for each row
execute function public.sync_brd_fc_actual_age();

create or replace function public.enforce_brd_fc_reverse_order()
returns trigger
language plpgsql
as $$
declare
  v_later_mortality_age integer;
  v_later_feed_age integer;
begin
  if old.void = '1'
    and coalesce(old.mort_am, 0) + coalesce(old.mort_pm, 0) > 0
    and (
      new.void <> '1'
      or coalesce(new.mort_am, 0) + coalesce(new.mort_pm, 0) <= 0
    ) then
    select max(later_line.age)
    into v_later_mortality_age
    from public.brd_fc_line later_line
    where later_line.fc_id = old.fc_id
      and later_line.void = '1'
      and later_line.age > old.age
      and coalesce(later_line.mort_am, 0) + coalesce(later_line.mort_pm, 0) > 0;

    if v_later_mortality_age is not null then
      raise exception 'Unable to reverse mortality at age %: reverse mortality at age % first.', old.age, v_later_mortality_age;
    end if;
  end if;

  if old.void = '1'
    and coalesce(old.feed_kg, 0) > 0
    and (new.void <> '1' or coalesce(new.feed_kg, 0) <= 0) then
    select max(later_line.age)
    into v_later_feed_age
    from public.brd_fc_line later_line
    where later_line.fc_id = old.fc_id
      and later_line.void = '1'
      and later_line.age > old.age
      and coalesce(later_line.feed_kg, 0) > 0;

    if v_later_feed_age is not null then
      raise exception 'Unable to reverse feed intake at age %: reverse feed intake at age % first.', old.age, v_later_feed_age;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_brd_fc_reverse_order_on_line on public.brd_fc_line;
create trigger enforce_brd_fc_reverse_order_on_line
before update on public.brd_fc_line
for each row
execute function public.enforce_brd_fc_reverse_order();

commit;

begin;

update public.brd_fc card
set actual_age = (
  select max(line.age)
  from public.brd_fc_line line
  where line.fc_id = card.id
    and line.void = '1'
    and coalesce(line.mort_am, 0) + coalesce(line.mort_pm, 0) > 0
)
where card.actual_age is distinct from (
  select max(line.age)
  from public.brd_fc_line line
  where line.fc_id = card.id
    and line.void = '1'
    and coalesce(line.mort_am, 0) + coalesce(line.mort_pm, 0) > 0
);

alter table public.brd_fc
  validate constraint brd_fc_actual_age_check;

notify pgrst, 'reload schema';

commit;
