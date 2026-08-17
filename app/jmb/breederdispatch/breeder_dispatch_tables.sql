begin;

create table if not exists public.tbl_brd_dispatch (
  id bigint generated always as identity primary key,
  created_by uuid null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_by uuid null references auth.users (id),
  updated_at timestamptz null,
  document_no text not null unique,
  dispatch_date date not null,
  farm_id bigint not null references public.farms (id),
  farm_code text null,
  farm_name text not null,
  destination text not null,
  hauler_name text null,
  plate_number text null,
  truck_seal text null,
  status text not null default 'Draft',
  remarks text null,
  cancelled_by uuid null references auth.users (id),
  cancelled_at timestamptz null,
  cancellation_reason text null,
  constraint brd_dispatch_status_check check (status in ('Draft', 'Posted', 'Cancelled')),
  constraint brd_dispatch_destination_check check (nullif(btrim(destination), '') is not null),
  constraint brd_dispatch_cancel_check check (
    status <> 'Cancelled'
    or (cancelled_by is not null and cancelled_at is not null and nullif(btrim(cancellation_reason), '') is not null)
  )
);

create table if not exists public.tbl_brd_dispatch_line (
  id bigint generated always as identity primary key,
  created_by uuid null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_by uuid null references auth.users (id),
  updated_at timestamptz null,
  dispatch_id bigint not null references public.tbl_brd_dispatch (id) on delete cascade,
  line_no integer not null,
  placement_id bigint not null references public.tbl_placement (id),
  placement_date date not null,
  building_id bigint not null references public.i_warehouse (id),
  building_name text not null,
  pen_id bigint not null references public.i_warehouse (id),
  pen_name text not null,
  dr_no text null,
  male_available integer not null default 0,
  female_available integer not null default 0,
  male_qty integer not null default 0,
  female_qty integer not null default 0,
  avg_body_weight_male numeric(18, 6) null,
  avg_body_weight_female numeric(18, 6) null,
  remarks text null,
  constraint brd_dispatch_line_no_key unique (dispatch_id, line_no),
  constraint brd_dispatch_placement_key unique (dispatch_id, placement_id),
  constraint brd_dispatch_line_qty_check check (
    male_qty >= 0 and female_qty >= 0 and male_qty + female_qty > 0
  ),
  constraint brd_dispatch_line_available_check check (
    male_available >= 0 and female_available >= 0
    and male_qty <= male_available and female_qty <= female_available
  )
);

create index if not exists brd_dispatch_date_idx on public.tbl_brd_dispatch (dispatch_date desc);
create index if not exists brd_dispatch_farm_idx on public.tbl_brd_dispatch (farm_id, dispatch_date desc);
create index if not exists brd_dispatch_status_idx on public.tbl_brd_dispatch (status);
create index if not exists brd_dispatch_line_dispatch_idx on public.tbl_brd_dispatch_line (dispatch_id);
create index if not exists brd_dispatch_line_placement_idx on public.tbl_brd_dispatch_line (placement_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists set_brd_dispatch_updated_at on public.tbl_brd_dispatch;
create trigger set_brd_dispatch_updated_at before update on public.tbl_brd_dispatch
for each row execute function public.set_updated_at();

drop trigger if exists set_brd_dispatch_line_updated_at on public.tbl_brd_dispatch_line;
create trigger set_brd_dispatch_line_updated_at before update on public.tbl_brd_dispatch_line
for each row execute function public.set_updated_at();

create or replace function public.brd_flock_balance(
  p_placement_id bigint,
  p_as_of_date date,
  p_sex text
) returns numeric language sql stable as $$
  select greatest(0, coalesce(
    case when p_sex = 'male'
      then placement.m_endingbalance
      else placement.f_endingbalance
    end,
    case when p_sex = 'male'
      then placement.m_beg - placement.m_doa - placement.m_reject - placement.m_shortcount
      else placement.f_beg - placement.f_doa - placement.f_reject - placement.f_shortcount
    end,
    0
  ) + coalesce(sum(
    case when p_sex = 'male'
      then daily.trans_in_male - daily.mc_male - daily.cull_male - daily.trans_out_male
      else daily.trans_in_female - daily.mc_female - daily.cull_female - daily.trans_out_female
    end
  ), 0))
  from public.tbl_placement placement
  left join public.tbl_breeder_daily_performance daily
    on daily.placement_id = placement.id
   and daily.isactive = true
   and daily.daterec <= p_as_of_date
  where placement.id = p_placement_id
  group by placement.id;
$$;

create or replace function public.apply_brd_dispatch_to_flock_card()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  line record;
  current_male numeric;
  current_female numeric;
begin
  if tg_op = 'UPDATE' and old.status = 'Draft' and new.status = 'Posted' then
    if not exists (select 1 from public.tbl_brd_dispatch_line where dispatch_id = new.id) then
      raise exception 'At least one flock-card line is required.';
    end if;
    if exists (
      select 1
      from public.tbl_brd_dispatch_line dispatch_line
      join public.tbl_placement placement on placement.id = dispatch_line.placement_id
      where dispatch_line.dispatch_id = new.id
        and (placement.farm_id <> new.farm_id or placement.placement_date > new.dispatch_date)
    ) then
      raise exception 'Every flock card must belong to the dispatch farm and be placed by the dispatch date.';
    end if;

    for line in
      select placement_id, sum(male_qty)::integer as male_qty, sum(female_qty)::integer as female_qty
      from public.tbl_brd_dispatch_line where dispatch_id = new.id group by placement_id
    loop
      select public.brd_flock_balance(line.placement_id, new.dispatch_date, 'male'),
             public.brd_flock_balance(line.placement_id, new.dispatch_date, 'female')
        into current_male, current_female;
      if line.male_qty > current_male or line.female_qty > current_female then
        raise exception 'Dispatch quantity exceeds current flock-card inventory for placement %.', line.placement_id;
      end if;

      update public.tbl_breeder_daily_performance
         set trans_out_male = trans_out_male + line.male_qty,
             trans_out_female = trans_out_female + line.female_qty,
             updated_by = coalesce(new.updated_by, new.created_by),
             updated_at = now()
       where placement_id = line.placement_id and daterec = new.dispatch_date and isactive = true;

      if not found then
        insert into public.tbl_breeder_daily_performance (
          placement_id, daterec, inv_male, inv_female, mc_male, mc_female,
          cull_male, cull_female, trans_in_male, trans_in_female,
          trans_out_male, trans_out_female, avg_body_weight_male,
          avg_body_weight_female, feed_consumption_male, feed_consumption_female,
          male_feedtype_id, female_feedtype_id, isactive, created_by
        ) values (
          line.placement_id, new.dispatch_date, current_male, current_female, 0, 0,
          0, 0, 0, 0, line.male_qty, line.female_qty, 0, 0, 0, 0,
          null, null, true, coalesce(new.updated_by, new.created_by)
        );
      end if;
    end loop;
  elsif tg_op = 'UPDATE' and old.status = 'Posted' and new.status = 'Cancelled' then
    for line in
      select placement_id, sum(male_qty)::integer as male_qty, sum(female_qty)::integer as female_qty
      from public.tbl_brd_dispatch_line where dispatch_id = new.id group by placement_id
    loop
      update public.tbl_breeder_daily_performance
         set trans_out_male = greatest(0, trans_out_male - line.male_qty),
             trans_out_female = greatest(0, trans_out_female - line.female_qty),
             updated_by = coalesce(new.updated_by, new.cancelled_by),
             updated_at = now()
       where placement_id = line.placement_id and daterec = new.dispatch_date and isactive = true;
    end loop;
  end if;
  return new;
end;
$$;

revoke all on function public.apply_brd_dispatch_to_flock_card() from public;

drop trigger if exists apply_brd_dispatch_to_flock_card_trigger on public.tbl_brd_dispatch;
create trigger apply_brd_dispatch_to_flock_card_trigger
after update of status on public.tbl_brd_dispatch
for each row execute function public.apply_brd_dispatch_to_flock_card();

create or replace function public.guard_brd_dispatch_change()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'Draft' then raise exception 'Only draft dispatches can be deleted'; end if;
    return old;
  end if;
  if old.status = 'Cancelled' then raise exception 'Cancelled dispatches are immutable'; end if;
  if old.status = 'Posted' and new.status <> 'Cancelled' then
    raise exception 'Posted dispatches are immutable';
  end if;
  if old.status = 'Draft' and new.status not in ('Draft', 'Posted') then
    raise exception 'Invalid dispatch status transition';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_brd_dispatch_change_trigger on public.tbl_brd_dispatch;
create trigger guard_brd_dispatch_change_trigger before update or delete on public.tbl_brd_dispatch
for each row execute function public.guard_brd_dispatch_change();

create or replace function public.guard_brd_dispatch_line_change()
returns trigger language plpgsql as $$
declare parent_status text;
begin
  select status into parent_status from public.tbl_brd_dispatch
  where id = case when tg_op = 'DELETE' then old.dispatch_id else new.dispatch_id end;
  -- A cascading draft-header delete may make the parent invisible before its
  -- child rows are removed. Direct line changes still require a live draft.
  if parent_status is null and tg_op = 'DELETE' then return old; end if;
  if parent_status is distinct from 'Draft' then raise exception 'Only draft dispatch lines can be changed'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists guard_brd_dispatch_line_change_trigger on public.tbl_brd_dispatch_line;
create trigger guard_brd_dispatch_line_change_trigger before insert or update or delete on public.tbl_brd_dispatch_line
for each row execute function public.guard_brd_dispatch_line_change();

create or replace view public.brd_dispatch_register as
select header.*,
       count(line.id)::integer as line_count,
       coalesce(sum(line.male_qty), 0)::integer as male_qty,
       coalesce(sum(line.female_qty), 0)::integer as female_qty,
       coalesce(sum(line.male_qty + line.female_qty), 0)::integer as total_qty
from public.tbl_brd_dispatch header
left join public.tbl_brd_dispatch_line line on line.dispatch_id = header.id
group by header.id;

commit;
