create table if not exists public.goods_receipt (
  id bigint generated always as identity not null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_by uuid null,
  updated_at timestamp with time zone null,
  gr_no text not null,
  vendor text not null,
  receive_date date not null,
  farm_id bigint null,
  farm_code text null,
  farm_name text null,
  default_warehouse_id bigint null,
  status text not null default 'Draft',
  remarks text null,
  constraint goods_reciept_pkey primary key (id),
  constraint goods_reciept_gr_no_key unique (gr_no),
  constraint goods_reciept_status_check check (status in ('Draft', 'Posted', 'Cancelled')),
  constraint goods_reciept_farm_id_fkey foreign key (farm_id) references public.farms (id),
  constraint goods_reciept_default_warehouse_id_fkey foreign key (default_warehouse_id) references public.i_warehouse (id),
  constraint goods_reciept_created_by_fkey foreign key (created_by) references auth.users (id),
  constraint goods_reciept_updated_by_fkey foreign key (updated_by) references auth.users (id)
);

create table if not exists public.goods_receipt_items (
  id bigint generated always as identity not null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_by uuid null,
  updated_at timestamp with time zone null,
  goods_reciept_id bigint not null,
  line_no integer not null,
  item_id bigint null,
  item_code text not null,
  description text null,
  batch_rule_id bigint null,
  batch_number text null,
  supplier_batch_number text null,
  manufacturing_date date null,
  expiry_date date null,
  alt_qty numeric(18, 6) not null default 0,
  alt_uom text not null,
  base_qty numeric(18, 6) not null default 0,
  base_uom text not null,
  warehouse_id bigint null,
  warehouse_code text null,
  warehouse_name text null,
  returned_qty numeric(18, 6) not null default 0,
  void text not null default '1',
  constraint goods_reciept_items_pkey primary key (id),
  constraint goods_reciept_items_receipt_line_key unique (goods_reciept_id, line_no),
  constraint goods_reciept_items_qty_check check (alt_qty >= 0 and base_qty >= 0 and returned_qty >= 0),
  constraint goods_reciept_items_goods_reciept_id_fkey foreign key (goods_reciept_id) references public.goods_receipt (id) on delete cascade,
  constraint goods_reciept_items_item_id_fkey foreign key (item_id) references public.items (id),
  constraint goods_reciept_items_batch_rule_id_fkey foreign key (batch_rule_id) references public.batch_rules (id),
  constraint goods_reciept_items_warehouse_id_fkey foreign key (warehouse_id) references public.i_warehouse (id),
  constraint goods_reciept_items_created_by_fkey foreign key (created_by) references auth.users (id),
  constraint goods_reciept_items_updated_by_fkey foreign key (updated_by) references auth.users (id)
);

create index if not exists goods_reciept_receive_date_idx
  on public.goods_receipt (receive_date desc);

create index if not exists goods_reciept_farm_id_idx
  on public.goods_receipt (farm_id);

create index if not exists goods_reciept_status_idx
  on public.goods_receipt (status);

create index if not exists goods_reciept_items_goods_reciept_id_idx
  on public.goods_receipt_items (goods_reciept_id);

create index if not exists goods_reciept_items_item_id_idx
  on public.goods_receipt_items (item_id);

create index if not exists goods_reciept_items_batch_number_idx
  on public.goods_receipt_items (batch_number);

create index if not exists goods_reciept_items_warehouse_id_idx
  on public.goods_receipt_items (warehouse_id);

create index if not exists goods_reciept_items_void_idx
  on public.goods_receipt_items (void);

create table if not exists public.item_batches (
  id bigint generated always as identity not null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_by uuid null,
  updated_at timestamp with time zone null,
  item_id bigint null,
  item_code text not null,
  batch_number text not null,
  supplier_batch_number text null,
  manufacturing_date date not null,
  expiry_date date not null,
  batch_rule_id bigint null,
  source_gr_id bigint null,
  status text not null default 'Active',
  void text not null default '1',
  constraint item_batches_pkey primary key (id),
  constraint item_batches_item_id_fkey foreign key (item_id) references public.items (id),
  constraint item_batches_batch_rule_id_fkey foreign key (batch_rule_id) references public.batch_rules (id),
  constraint item_batches_source_gr_id_fkey foreign key (source_gr_id) references public.goods_receipt (id),
  constraint item_batches_created_by_fkey foreign key (created_by) references auth.users (id),
  constraint item_batches_updated_by_fkey foreign key (updated_by) references auth.users (id),
  constraint item_batches_status_check check (status in ('Active', 'Hold', 'Blocked', 'Closed')),
  constraint item_batches_dates_check check (expiry_date >= manufacturing_date)
);

create unique index if not exists item_batches_item_dates_active_key
  on public.item_batches (item_code, manufacturing_date, expiry_date)
  where void = '1';

create index if not exists item_batches_batch_number_idx
  on public.item_batches (batch_number);

create index if not exists item_batches_item_code_idx
  on public.item_batches (item_code);

create index if not exists item_batches_expiry_date_idx
  on public.item_batches (expiry_date);

create index if not exists item_batches_void_idx
  on public.item_batches (void);

alter table public.goods_receipt_items
  add column if not exists batch_rule_id bigint null,
  add column if not exists batch_number text null,
  add column if not exists supplier_batch_number text null,
  add column if not exists manufacturing_date date null,
  add column if not exists expiry_date date null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'goods_reciept_items_batch_rule_id_fkey'
  ) then
    alter table public.goods_receipt_items
      add constraint goods_reciept_items_batch_rule_id_fkey
      foreign key (batch_rule_id) references public.batch_rules (id);
  end if;
end;
$$;

update public.goods_receipt
set status = 'Posted'
where status = 'Received';

update public.goods_receipt
set status = 'Draft'
where status is null
   or status not in ('Draft', 'Posted', 'Cancelled');

do $$
begin
  alter table public.goods_receipt
    drop constraint if exists goods_reciept_status_check;

  alter table public.goods_receipt
    add constraint goods_reciept_status_check
    check (status in ('Draft', 'Posted', 'Cancelled'));
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_goods_reciept_updated_at'
  ) then
    create trigger set_goods_reciept_updated_at
    before update on public.goods_receipt
    for each row
    execute function public.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_goods_reciept_items_updated_at'
  ) then
    create trigger set_goods_reciept_items_updated_at
    before update on public.goods_receipt_items
    for each row
    execute function public.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_item_batches_updated_at'
  ) then
    create trigger set_item_batches_updated_at
    before update on public.item_batches
    for each row
    execute function public.set_updated_at();
  end if;
end;
$$;
