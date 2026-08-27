begin;

alter table public.inventory_postings
  add column if not exists batch_number text null;

create table if not exists public.br_delivery (
  id bigint generated always as identity primary key,
  created_by uuid null references auth.users (id),
  created_at timestamp with time zone not null default now(),
  updated_by uuid null references auth.users (id),
  updated_at timestamp with time zone null,
  gi_no text not null unique,
  issue_date date not null,
  farm_id bigint null references public.farms (id),
  farm_code text null,
  farm_name text null,
  from_warehouse_id bigint null references public.i_warehouse (id),
  from_warehouse_code text null,
  from_warehouse_name text null,
  triggered_by text not null default 'BR-DR',
  status text not null default 'Draft',
  remarks text null,
  hauler_name text null,
  plate_number text null,
  truck_seal numeric null,
  destination text null,
  constraint br_delivery_status_check check (status in ('Draft', 'Posted', 'Cancelled'))
);

create table if not exists public.br_delivery_lines (
  id bigint generated always as identity primary key,
  created_by uuid null references auth.users (id),
  created_at timestamp with time zone not null default now(),
  updated_by uuid null references auth.users (id),
  updated_at timestamp with time zone null,
  br_delivery_id bigint not null references public.br_delivery (id) on delete cascade,
  line_no integer not null,
  allocation_group_key text null,
  hauler_name text null,
  plate_number text null,
  destination text null,
  live_sales_customer_name text null,
  truck_seal numeric null,
  item_id bigint null references public.items (id),
  item_code text not null,
  description text null,
  batch_rule_id bigint null references public.batch_rules (id),
  batch_number text null,
  manufacturing_date date null,
  expiry_date date null,
  alt_qty numeric(18, 6) not null default 0,
  alt_uom text not null,
  base_qty numeric(18, 6) not null default 0,
  base_uom text not null,
  from_warehouse_id bigint null references public.i_warehouse (id),
  from_warehouse_code text null,
  from_warehouse_name text null,
  void text not null default '1',
  constraint br_delivery_lines_delivery_line_key unique (br_delivery_id, line_no),
  constraint br_delivery_lines_qty_check check (alt_qty >= 0 and base_qty >= 0)
);

alter table public.br_delivery_lines
  add column if not exists allocation_group_key text null,
  add column if not exists hauler_name text null,
  add column if not exists plate_number text null,
  add column if not exists destination text null,
  add column if not exists live_sales_customer_name text null,
  add column if not exists truck_seal numeric null;

create index if not exists br_delivery_issue_date_idx on public.br_delivery (issue_date desc);
create index if not exists br_delivery_farm_id_idx on public.br_delivery (farm_id);
create index if not exists br_delivery_status_idx on public.br_delivery (status);
create index if not exists br_delivery_lines_delivery_id_idx on public.br_delivery_lines (br_delivery_id);
create index if not exists br_delivery_lines_item_id_idx on public.br_delivery_lines (item_id);
create index if not exists br_delivery_lines_batch_number_idx on public.br_delivery_lines (batch_number);
create index if not exists br_delivery_lines_warehouse_id_idx on public.br_delivery_lines (from_warehouse_id);
create index if not exists br_delivery_lines_void_idx on public.br_delivery_lines (void);

alter table public.br_delivery
  add column if not exists hauler_name text null,
  add column if not exists plate_number text null,
  add column if not exists truck_seal numeric null,
  add column if not exists destination text null;

alter table public.br_delivery
  alter column hauler_name type text using hauler_name::text,
  alter column plate_number type text using plate_number::text;

insert into public.br_delivery (
  id, created_by, created_at, updated_by, updated_at, gi_no, issue_date,
  farm_id, farm_code, farm_name, from_warehouse_id, from_warehouse_code,
  from_warehouse_name, triggered_by, status, remarks
)
overriding system value
select
  id, created_by, created_at, updated_by, updated_at, gi_no, issue_date,
  farm_id, farm_code, farm_name, from_warehouse_id, from_warehouse_code,
  from_warehouse_name, 'BR-DR', status, remarks
from public.goods_issue
where triggered_by = 'BR-DR'
on conflict (id) do nothing;

insert into public.br_delivery_lines (
  id, created_by, created_at, updated_by, updated_at, br_delivery_id, line_no,
  item_id, item_code, description, batch_rule_id, batch_number,
  manufacturing_date, expiry_date, alt_qty, alt_uom, base_qty, base_uom,
  from_warehouse_id, from_warehouse_code, from_warehouse_name, void
)
overriding system value
select
  line.id, line.created_by, line.created_at, line.updated_by, line.updated_at,
  line.goods_issue_id, line.line_no, line.item_id, line.item_code,
  line.description, line.batch_rule_id, line.batch_number,
  line.manufacturing_date, line.expiry_date, line.alt_qty, line.alt_uom,
  line.base_qty, line.base_uom, line.from_warehouse_id,
  line.from_warehouse_code, line.from_warehouse_name, line.void
from public.goods_issue_items line
join public.goods_issue header on header.id = line.goods_issue_id
where header.triggered_by = 'BR-DR'
on conflict (id) do nothing;

update public.br_delivery_lines line
set allocation_group_key = concat(
  'legacy:',
  line.br_delivery_id,
  ':',
  upper(trim(coalesce(line.from_warehouse_code, ''))),
  ':',
  upper(trim(line.item_code))
)
where nullif(trim(line.allocation_group_key), '') is null;

alter table public.br_delivery_lines
  alter column allocation_group_key set default gen_random_uuid()::text,
  alter column allocation_group_key set not null;

create index if not exists br_delivery_lines_allocation_group_key_idx
  on public.br_delivery_lines (br_delivery_id, allocation_group_key)
  where void = '1';

update public.inventory_postings posting
set source_doc_type = 'BR_DELIVERY'
where posting.source_doc_type = 'GOODS_ISSUE'
  and exists (
    select 1
    from public.goods_issue header
    where header.id = posting.source_docentry
      and header.triggered_by = 'BR-DR'
  );

delete from public.goods_issue
where triggered_by = 'BR-DR';

select setval(
  pg_get_serial_sequence('public.br_delivery', 'id'),
  greatest(coalesce((select max(id) from public.br_delivery), 1), 1),
  exists(select 1 from public.br_delivery)
);
select setval(
  pg_get_serial_sequence('public.br_delivery_lines', 'id'),
  greatest(coalesce((select max(id) from public.br_delivery_lines), 1), 1),
  exists(select 1 from public.br_delivery_lines)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.validate_br_delivery_actual_age()
returns trigger
language plpgsql
as $$
declare
  v_target_age integer := 0;
  v_invalid_building text;
begin
  select coalesce(settings.target_delivery_age, 0)
  into v_target_age
  from public.brd_dr_settings settings
  where settings.farm_id = new.farm_id
    and settings.void = '1'
  order by settings.created_at desc
  limit 1;

  v_target_age := coalesce(v_target_age, 0);

  with selected_buildings as (
    select distinct line.from_warehouse_id, line.from_warehouse_code
    from public.br_delivery_lines line
    where line.br_delivery_id = new.id
      and line.void = '1'
  ), active_cycles as (
    select selected.from_warehouse_code, cycle.id, cycle.building_name, cycle.actual_age
    from selected_buildings selected
    left join lateral (
      select card.id, card.building_name, growing.actual_age
      from public.flock_card card
      left join lateral (
        select daily.actual_age
        from public.brd_fc daily
        where daily.card_no = card.card_no
          and daily.farm_id = card.farm_id
          and daily.void = '1'
        order by daily.id desc
        limit 1
      ) growing on true
      where card.farm_id = new.farm_id
        and card.void = '1'
        and card.status = 'Saved'
        and (
          (selected.from_warehouse_id is not null and card.building_whse_id = selected.from_warehouse_id)
          or card.building_code = selected.from_warehouse_code
        )
      order by card.start_date desc, card.id desc
      limit 1
    ) cycle on true
  )
  select coalesce(active.building_name, active.from_warehouse_code)
  into v_invalid_building
  from active_cycles active
  where active.id is null
     or active.actual_age is null
     or active.actual_age < v_target_age
  limit 1;

  if v_invalid_building is not null then
    raise exception '% has no eligible Growing age for Harvest & Delivery. Actual age must be at least %.', v_invalid_building, v_target_age;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_br_delivery_actual_age_trigger on public.br_delivery;
create trigger validate_br_delivery_actual_age_trigger
before update of status on public.br_delivery
for each row
when (new.status = 'Posted' and old.status is distinct from 'Posted')
execute function public.validate_br_delivery_actual_age();

create or replace function public.post_br_delivery_inventory()
returns trigger
language plpgsql
as $$
begin
  if new.status <> 'Posted' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'Posted' then
    return new;
  end if;

  if exists (
    with issue_qty as (
      select
        line.item_code,
        line.from_warehouse_code as warehouse_code,
        line.batch_number,
        sum(line.base_qty) as required_qty
      from public.br_delivery_lines line
      where line.br_delivery_id = new.id
        and line.void = '1'
        and line.item_code is not null
        and line.from_warehouse_code is not null
        and line.base_qty > 0
      group by line.item_code, line.from_warehouse_code, line.batch_number
    ),
    on_hand as (
      select
        posting.item_code,
        posting.warehouse_code,
        coalesce(posting.batch_number, posting.ref) as batch_number,
        sum(case when posting.transfer_type = 'OUT' then -posting.qty else posting.qty end) as qty
      from public.inventory_postings posting
      group by
        posting.item_code,
        posting.warehouse_code,
        coalesce(posting.batch_number, posting.ref)
    )
    select 1
    from issue_qty required
    left join on_hand available
      on available.item_code = required.item_code
     and available.warehouse_code = required.warehouse_code
     and available.batch_number is not distinct from required.batch_number
    where required.required_qty > coalesce(available.qty, 0)
  ) then
    raise exception 'Broiler delivery quantity exceeds on-hand inventory.';
  end if;

  insert into public.inventory_postings (
    source_doc_type, source_docentry, item_code, warehouse_code, bin_code, batch_number,
    qty, created_by, ref_type, ref, transfer_type, ref_type2, ref2
  )
  select
    'BR_DELIVERY',
    new.id,
    line.item_code,
    line.from_warehouse_code,
    'MAIN SUB BIN',
    line.batch_number,
    sum(line.base_qty),
    coalesce(new.updated_by, new.created_by),
    'batch_code',
    line.batch_number,
    'OUT',
    null,
    null
  from public.br_delivery_lines line
  where line.br_delivery_id = new.id
    and line.void = '1'
    and line.item_code is not null
    and line.from_warehouse_code is not null
    and line.base_qty > 0
  group by line.item_code, line.from_warehouse_code, line.batch_number;

  return new;
end;
$$;

drop trigger if exists post_br_delivery_inventory_trigger on public.br_delivery;
create trigger post_br_delivery_inventory_trigger
after update of status on public.br_delivery
for each row
when (new.status = 'Posted' and old.status is distinct from 'Posted')
execute function public.post_br_delivery_inventory();

drop trigger if exists set_br_delivery_updated_at on public.br_delivery;
create trigger set_br_delivery_updated_at
before update on public.br_delivery
for each row execute function public.set_updated_at();

drop trigger if exists set_br_delivery_lines_updated_at on public.br_delivery_lines;
create trigger set_br_delivery_lines_updated_at
before update on public.br_delivery_lines
for each row execute function public.set_updated_at();

commit;
