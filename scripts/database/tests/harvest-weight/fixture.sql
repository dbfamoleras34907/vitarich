-- Disposable database only. Minimal dependencies; does not model inventory posting or production business RLS.
create role authenticated; create role anon;
create schema auth;
create table auth.users(id uuid primary key);
insert into auth.users values ('00000000-0000-0000-0000-000000000001');
create function auth.uid() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;
create table farms(id bigint primary key, code text, name text);
insert into farms values (1, 'FARM-A', 'Farm A');
create table i_warehouse(id bigint primary key);
create table items(id bigint primary key);
create table batch_rules(id bigint primary key);
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
  ts_dr_no text null,
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


alter table br_delivery_lines add column delivered_date date;
create table notification_outbox(module_key text,event_key text,entity_type text,entity_id text,document_no text,fms_type text,farm_id bigint,recipient_farm_id bigint,actor_auth_id uuid,target_url text,permission_group text,permission_title text,title text,message text,priority text,metadata jsonb,dedupe_key text unique,occurred_at timestamptz);
alter table notification_outbox enable row level security;
grant usage on schema public, auth to authenticated;
grant select, insert, update on br_delivery, br_delivery_lines to authenticated;
grant select on farms to authenticated;
grant usage, select on all sequences in schema public to authenticated;
