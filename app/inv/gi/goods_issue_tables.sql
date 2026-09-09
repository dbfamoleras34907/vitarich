create table if not exists public.goods_issue (
  id bigint generated always as identity not null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_by uuid null,
  updated_at timestamp with time zone null,
  gi_no text not null,
  issue_date date not null,
  farm_id bigint null,
  farm_code text null,
  farm_name text null,
  from_warehouse_id bigint null,
  from_warehouse_code text null,
  from_warehouse_name text null,
  triggered_by text not null default 'GI',
  status text not null default 'Posted',
  remarks text null,
  constraint goods_issue_pkey primary key (id),
  constraint goods_issue_gi_no_key unique (gi_no),
  constraint goods_issue_status_check check (status in ('Draft', 'Posted', 'Cancelled')),
  constraint goods_issue_farm_id_fkey foreign key (farm_id) references public.farms (id),
  constraint goods_issue_from_warehouse_id_fkey foreign key (from_warehouse_id) references public.i_warehouse (id),
  constraint goods_issue_created_by_fkey foreign key (created_by) references auth.users (id),
  constraint goods_issue_updated_by_fkey foreign key (updated_by) references auth.users (id)
);

create table if not exists public.goods_issue_items (
  id bigint generated always as identity not null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_by uuid null,
  updated_at timestamp with time zone null,
  goods_issue_id bigint not null,
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
  void text not null default '1',
  constraint goods_issue_items_pkey primary key (id),
  constraint goods_issue_items_issue_line_key unique (goods_issue_id, line_no),
  constraint goods_issue_items_qty_check check (alt_qty >= 0 and base_qty >= 0),
  constraint goods_issue_items_goods_issue_id_fkey foreign key (goods_issue_id) references public.goods_issue (id) on delete cascade,
  constraint goods_issue_items_item_id_fkey foreign key (item_id) references public.items (id),
  constraint goods_issue_items_batch_rule_id_fkey foreign key (batch_rule_id) references public.batch_rules (id),
  constraint goods_issue_items_from_warehouse_id_fkey foreign key (from_warehouse_id) references public.i_warehouse (id),
  constraint goods_issue_items_created_by_fkey foreign key (created_by) references auth.users (id),
  constraint goods_issue_items_updated_by_fkey foreign key (updated_by) references auth.users (id)
);

create index if not exists goods_issue_issue_date_idx
  on public.goods_issue (issue_date desc);

create index if not exists goods_issue_farm_id_idx
  on public.goods_issue (farm_id);

create index if not exists goods_issue_status_idx
  on public.goods_issue (status);

create index if not exists goods_issue_items_goods_issue_id_idx
  on public.goods_issue_items (goods_issue_id);

create index if not exists goods_issue_items_item_id_idx
  on public.goods_issue_items (item_id);

create index if not exists goods_issue_items_batch_number_idx
  on public.goods_issue_items (batch_number);

create index if not exists goods_issue_items_from_warehouse_id_idx
  on public.goods_issue_items (from_warehouse_id);

create index if not exists goods_issue_items_void_idx
  on public.goods_issue_items (void);

alter table public.goods_issue
  add column if not exists triggered_by text not null default 'GI',
  drop constraint if exists goods_issue_to_warehouse_id_fkey,
  drop column if exists to_warehouse_id,
  drop column if exists to_warehouse_code,
  drop column if exists to_warehouse_name;

alter table public.goods_issue
  alter column triggered_by set default 'GI';

update public.goods_issue
set triggered_by = 'GI'
where triggered_by is null or btrim(triggered_by) = '';

alter table public.goods_issue
  alter column triggered_by set not null;

create index if not exists goods_issue_triggered_by_idx
  on public.goods_issue (triggered_by);

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
    where tgname = 'set_goods_issue_updated_at'
  ) then
    create trigger set_goods_issue_updated_at
    before update on public.goods_issue
    for each row
    execute function public.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_goods_issue_items_updated_at'
  ) then
    create trigger set_goods_issue_items_updated_at
    before update on public.goods_issue_items
    for each row
    execute function public.set_updated_at();
  end if;
end;
$$;
