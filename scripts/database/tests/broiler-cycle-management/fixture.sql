create schema if not exists auth;
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;

create table auth.users(id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.auth_uid', true), '')::uuid
$$;

create table public.users(
  id bigint primary key,
  auth_id uuid not null,
  isactive text,
  user_type integer
);
create table public.user_permissions(user_id uuid, ilink text, is_visible boolean);
create table public.farms(
  id bigint primary key,
  code text,
  name text,
  farm_type text default 'BR',
  associated_warehouses jsonb[]
);
create table public.users_farms(users_id bigint, farm_id bigint, void text);
create table public.i_warehouse(
  id bigint primary key,
  whse_code text,
  whse_name text,
  warehouse_type text,
  is_active boolean,
  farm_id bigint,
  farm_code text
);
create table public.doc_cycle_excluded_buildings(farm_id bigint, building_whse_id bigint);

create table public.doc_farm_cycles(
  id bigint generated always as identity primary key,
  farm_id bigint not null references public.farms(id),
  cycle_no bigint not null,
  cycle_mask text,
  status text not null default 'Saved' constraint doc_farm_cycles_status_check
    check (status in ('Saved', 'Closed', 'Cancelled')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz,
  closed_at timestamptz,
  unique(farm_id, cycle_no)
);
create unique index doc_farm_cycles_one_saved_per_farm_idx
  on public.doc_farm_cycles(farm_id) where status = 'Saved';

create table public.flock_card(
  id bigint generated always as identity primary key,
  created_by uuid,
  card_no text unique,
  farm_id bigint not null,
  farm_code text,
  farm_name text,
  farm_cycle_id bigint references public.doc_farm_cycles(id),
  building_whse_id bigint,
  building_src text,
  building_key text,
  building_code text,
  building_name text,
  age integer not null default 0,
  start_date date not null default current_date,
  breed text,
  cycle_no text,
  animal_qty numeric not null default 0,
  sex text,
  status text,
  void text,
  extra jsonb default '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz
);
create table public.br_delivery(id bigint primary key);
create table public.br_cleanup(id bigint primary key);

create table public.notification_outbox(
  id uuid primary key default gen_random_uuid(),
  module_key text not null,
  event_key text not null,
  entity_type text not null,
  entity_id text not null,
  document_no text,
  fms_type text,
  farm_id bigint,
  recipient_farm_id bigint,
  actor_auth_id uuid,
  target_url text,
  permission_group text not null,
  permission_title text not null,
  title text not null,
  message text not null,
  priority text not null,
  posting_version integer,
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  status text not null default 'pending',
  occurred_at timestamptz not null default now(),
  processing_started_at timestamptz,
  processed_at timestamptz,
  last_error text
);

create function public.process_notification_outbox(p_limit integer default 50)
returns integer language plpgsql security definer set search_path=public as $$
declare
  v_event public.notification_outbox%rowtype;
  v_processed integer := 0;
  v_source_valid boolean;
begin
  for v_event in select * from public.notification_outbox where status='pending' limit p_limit loop
    if false then
      null;
      elsif v_event.module_key = 'BR_CLEANUP' then
        null;
    end if;
    update public.notification_outbox set status='processed',processed_at=now() where id=v_event.id;
    v_processed := v_processed + 1;
  end loop;
  return v_processed;
end;
$$;
