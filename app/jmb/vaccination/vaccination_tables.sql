begin;

create table if not exists public.tbl_brd_vaccination (
  id bigint generated always as identity primary key,
  created_by uuid null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_by uuid null references auth.users (id),
  updated_at timestamptz null,
  document_no text not null unique,
  vaccination_date date not null default current_date,
  farm_id bigint not null references public.farms (id),
  farm_code text null,
  farm_name text not null,
  scope text not null,
  building_id bigint null references public.i_warehouse (id),
  building_code text null,
  building_name text null,
  vaccine_brand text not null,
  vaccine_type text not null,
  disease_target text not null,
  dosage numeric(18, 6) not null,
  unit text not null,
  route text not null,
  booster_no integer not null default 1,
  next_dose_date date null,
  batch_number text not null,
  manufacturing_date date null,
  expiry_date date not null,
  birds_before integer not null default 0,
  birds_vaccinated integer not null default 0,
  birds_missed integer not null default 0,
  administered_by text null,
  supervised_by text null,
  cold_chain_verified boolean not null default false,
  label_verified boolean not null default false,
  expiry_verified boolean not null default false,
  status text not null default 'Posted',
  remarks text null,
  cancelled_by uuid null references auth.users (id),
  cancelled_at timestamptz null,
  cancellation_reason text null,
  extra jsonb not null default '{}'::jsonb,
  constraint brd_vaccination_scope_check check (
    scope in ('Farm', 'Building', 'Selected Pens', 'All Pens')
  ),
  constraint brd_vaccination_location_check check (
    (scope = 'Farm' and building_id is null)
    or (scope <> 'Farm' and building_id is not null)
  ),
  constraint brd_vaccination_dosage_check check (dosage > 0),
  constraint brd_vaccination_booster_check check (booster_no > 0),
  constraint brd_vaccination_route_check check (
    route in ('Water', 'Spray of bird', 'Injection-SC', 'Injection-IM', 'Wing web', 'Eye drop', 'Spray of feed', 'In-Ovo', 'Other')
  ),
  constraint brd_vaccination_dates_check check (
    (manufacturing_date is null or expiry_date >= manufacturing_date)
    and expiry_date >= vaccination_date
    and (next_dose_date is null or next_dose_date >= vaccination_date)
  ),
  constraint brd_vaccination_birds_check check (
    birds_before >= 0 and birds_vaccinated >= 0 and birds_missed >= 0
    and birds_vaccinated + birds_missed <= birds_before
  ),
  constraint brd_vaccination_status_check check (status in ('Posted', 'Cancelled')),
  constraint brd_vaccination_safety_check check (
    label_verified and expiry_verified and cold_chain_verified
  ),
  constraint brd_vaccination_cancel_check check (
    status <> 'Cancelled'
    or (cancelled_by is not null and cancelled_at is not null and nullif(btrim(cancellation_reason), '') is not null)
  )
);

-- For Selected Pens and All Pens, targets are snapshotted at posting time so
-- later location changes do not alter clinical history.
create table if not exists public.tbl_brd_vaccination_target (
  id bigint generated always as identity primary key,
  created_by uuid null references auth.users (id),
  created_at timestamptz not null default now(),
  vaccination_id bigint not null references public.tbl_brd_vaccination (id) on delete cascade,
  line_no integer not null,
  building_id bigint not null references public.i_warehouse (id),
  building_code text null,
  building_name text not null,
  pen_id bigint not null references public.i_warehouse (id),
  pen_code text null,
  pen_name text not null,
  constraint brd_vaccination_target_line_key unique (vaccination_id, line_no),
  constraint brd_vaccination_target_pen_key unique (vaccination_id, pen_id)
);

-- Follow-up observations support reaction monitoring and effectiveness review.
create table if not exists public.tbl_brd_vaccination_observation (
  id bigint generated always as identity primary key,
  created_by uuid null references auth.users (id),
  created_at timestamptz not null default now(),
  vaccination_id bigint not null references public.tbl_brd_vaccination (id),
  observed_at timestamptz not null default now(),
  observation_type text not null default 'Routine',
  birds_observed integer not null default 0,
  reaction_count integer not null default 0,
  mortality_count integer not null default 0,
  result text not null default 'Acceptable',
  findings text null,
  corrective_action text null,
  observed_by text null,
  constraint brd_vaccination_observation_type_check check (
    observation_type in ('Routine', 'Adverse Event', 'Serology', 'Veterinarian Review')
  ),
  constraint brd_vaccination_observation_result_check check (
    result in ('Acceptable', 'Monitor', 'Action Required', 'Closed')
  ),
  constraint brd_vaccination_observation_count_check check (
    birds_observed >= 0 and reaction_count >= 0 and mortality_count >= 0
  )
);

create index if not exists brd_vaccination_date_idx on public.tbl_brd_vaccination (vaccination_date desc);
create index if not exists brd_vaccination_farm_idx on public.tbl_brd_vaccination (farm_id, vaccination_date desc);
create index if not exists brd_vaccination_building_idx on public.tbl_brd_vaccination (building_id, vaccination_date desc);
create index if not exists brd_vaccination_batch_idx on public.tbl_brd_vaccination (batch_number);
create index if not exists brd_vaccination_status_idx on public.tbl_brd_vaccination (status);
create index if not exists brd_vaccination_target_document_idx on public.tbl_brd_vaccination_target (vaccination_id);
create index if not exists brd_vaccination_target_pen_idx on public.tbl_brd_vaccination_target (pen_id);
create index if not exists brd_vaccination_observation_document_idx on public.tbl_brd_vaccination_observation (vaccination_id, observed_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists set_brd_vaccination_updated_at on public.tbl_brd_vaccination;
create trigger set_brd_vaccination_updated_at before update on public.tbl_brd_vaccination
for each row execute function public.set_updated_at();

create or replace function public.guard_brd_vaccination_update()
returns trigger language plpgsql as $$
begin
  if old.status = 'Cancelled' then
    raise exception 'Cancelled vaccination records are immutable';
  end if;
  if new.status = 'Cancelled' then
    if (to_jsonb(new) - array['status','updated_by','updated_at','cancelled_by','cancelled_at','cancellation_reason'])
       is distinct from
       (to_jsonb(old) - array['status','updated_by','updated_at','cancelled_by','cancelled_at','cancellation_reason']) then
      raise exception 'Vaccination details cannot be changed during cancellation';
    end if;
  elsif new.status <> 'Posted' then
    raise exception 'Invalid vaccination status transition';
  elsif new.document_no is distinct from old.document_no
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
     or new.cancelled_by is distinct from old.cancelled_by
     or new.cancelled_at is distinct from old.cancelled_at
     or new.cancellation_reason is distinct from old.cancellation_reason then
    raise exception 'Vaccination audit fields cannot be edited';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_brd_vaccination_update_trigger on public.tbl_brd_vaccination;
create trigger guard_brd_vaccination_update_trigger before update on public.tbl_brd_vaccination
for each row execute function public.guard_brd_vaccination_update();

create or replace function public.guard_brd_vaccination_target_change()
returns trigger language plpgsql as $$
declare parent_status text;
begin
  if tg_op = 'DELETE' then
    select status into parent_status from public.tbl_brd_vaccination where id = old.vaccination_id;
    if parent_status <> 'Posted' then
      raise exception 'Cancelled vaccination targets are immutable';
    end if;
    return old;
  end if;

  select status into parent_status from public.tbl_brd_vaccination where id = new.vaccination_id;
  if parent_status <> 'Posted' then
    raise exception 'Cancelled vaccination targets are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_brd_vaccination_target_change_trigger on public.tbl_brd_vaccination_target;
create trigger guard_brd_vaccination_target_change_trigger before insert or update or delete on public.tbl_brd_vaccination_target
for each row execute function public.guard_brd_vaccination_target_change();

create or replace view public.brd_vaccination_register as
select
  vaccination.*,
  coalesce(count(target.id), 0)::integer as target_count,
  coalesce(
    string_agg(target.pen_name, ', ' order by target.line_no),
    case when vaccination.scope = 'Farm' then vaccination.farm_name else vaccination.building_name end
  ) as target_names
from public.tbl_brd_vaccination vaccination
left join public.tbl_brd_vaccination_target target on target.vaccination_id = vaccination.id
group by vaccination.id;

commit;
