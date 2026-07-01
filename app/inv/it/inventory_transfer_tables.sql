create table if not exists public.inventory_transfer (
  id bigint generated always as identity not null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_by uuid null,
  updated_at timestamp with time zone null,
  it_no text not null,
  transfer_date date not null,
  farm_id bigint null,
  farm_code text null,
  farm_name text null,
  from_warehouse_id bigint null,
  from_warehouse_code text null,
  from_warehouse_name text null,
  to_warehouse_id bigint null,
  to_warehouse_code text null,
  to_warehouse_name text null,
  requested_by text null,
  reference_doc_no text null,
  status text not null default 'Draft',
  remarks text null,
  constraint inventory_transfer_pkey primary key (id),
  constraint inventory_transfer_it_no_key unique (it_no),
  constraint inventory_transfer_status_check check (status in ('Draft', 'Posted', 'Cancelled')),
  constraint inventory_transfer_distinct_warehouse_check check (
    from_warehouse_code is null
    or to_warehouse_code is null
    or from_warehouse_code <> to_warehouse_code
  ),
  constraint inventory_transfer_farm_id_fkey foreign key (farm_id) references public.farms (id),
  constraint inventory_transfer_from_warehouse_id_fkey foreign key (from_warehouse_id) references public.i_warehouse (id),
  constraint inventory_transfer_to_warehouse_id_fkey foreign key (to_warehouse_id) references public.i_warehouse (id),
  constraint inventory_transfer_created_by_fkey foreign key (created_by) references auth.users (id),
  constraint inventory_transfer_updated_by_fkey foreign key (updated_by) references auth.users (id)
);

create table if not exists public.inventory_transfer_items (
  id bigint generated always as identity not null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_by uuid null,
  updated_at timestamp with time zone null,
  inventory_transfer_id bigint not null,
  line_no integer not null,
  item_id bigint null,
  item_code text not null,
  description text null,
  batch_rule_id bigint null,
  batch_number text null,
  manufacturing_date date null,
  expiry_date date null,
  alt_qty numeric(18, 6) not null default 0,
  alt_uom text not null,
  base_qty numeric(18, 6) not null default 0,
  base_uom text not null,
  from_warehouse_id bigint null,
  from_warehouse_code text null,
  from_warehouse_name text null,
  to_warehouse_id bigint null,
  to_warehouse_code text null,
  to_warehouse_name text null,
  remarks text null,
  void text not null default '1',
  constraint inventory_transfer_items_pkey primary key (id),
  constraint inventory_transfer_items_transfer_line_key unique (inventory_transfer_id, line_no),
  constraint inventory_transfer_items_qty_check check (alt_qty >= 0 and base_qty >= 0),
  constraint inventory_transfer_items_distinct_warehouse_check check (
    from_warehouse_code is null
    or to_warehouse_code is null
    or from_warehouse_code <> to_warehouse_code
  ),
  constraint inventory_transfer_items_transfer_id_fkey foreign key (inventory_transfer_id) references public.inventory_transfer (id) on delete cascade,
  constraint inventory_transfer_items_item_id_fkey foreign key (item_id) references public.items (id),
  constraint inventory_transfer_items_batch_rule_id_fkey foreign key (batch_rule_id) references public.batch_rules (id),
  constraint inventory_transfer_items_from_warehouse_id_fkey foreign key (from_warehouse_id) references public.i_warehouse (id),
  constraint inventory_transfer_items_to_warehouse_id_fkey foreign key (to_warehouse_id) references public.i_warehouse (id),
  constraint inventory_transfer_items_created_by_fkey foreign key (created_by) references auth.users (id),
  constraint inventory_transfer_items_updated_by_fkey foreign key (updated_by) references auth.users (id)
);

create index if not exists inventory_transfer_transfer_date_idx
  on public.inventory_transfer (transfer_date desc);

create index if not exists inventory_transfer_farm_id_idx
  on public.inventory_transfer (farm_id);

create index if not exists inventory_transfer_status_idx
  on public.inventory_transfer (status);

create index if not exists inventory_transfer_items_transfer_id_idx
  on public.inventory_transfer_items (inventory_transfer_id);

create index if not exists inventory_transfer_items_item_id_idx
  on public.inventory_transfer_items (item_id);

create index if not exists inventory_transfer_items_batch_number_idx
  on public.inventory_transfer_items (batch_number);

create index if not exists inventory_transfer_items_from_warehouse_id_idx
  on public.inventory_transfer_items (from_warehouse_id);

create index if not exists inventory_transfer_items_to_warehouse_id_idx
  on public.inventory_transfer_items (to_warehouse_id);

create index if not exists inventory_transfer_items_void_idx
  on public.inventory_transfer_items (void);

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
    where tgname = 'set_inventory_transfer_updated_at'
  ) then
    create trigger set_inventory_transfer_updated_at
    before update on public.inventory_transfer
    for each row
    execute function public.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_inventory_transfer_items_updated_at'
  ) then
    create trigger set_inventory_transfer_items_updated_at
    before update on public.inventory_transfer_items
    for each row
    execute function public.set_updated_at();
  end if;
end;
$$;
