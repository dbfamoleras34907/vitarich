-- TEST ONLY: run against a new disposable local database, never a live FMS database.
do $$begin if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; end;$$;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select '11111111-1111-1111-1111-111111111111'::uuid$$;
insert into auth.users values(auth.uid());
create table farms(id bigint primary key, code text, name text, farm_type text, associated_warehouses jsonb[]);
create table farm_buildings(id bigint primary key);
create table i_warehouse(id bigint primary key);
create table items(id bigint primary key, item_code text, item_name text, description text, sub_item_group_level_1_id bigint, sub_item_group_id bigint, void text);
create table item_groups(id bigint primary key, father bigint, void text);
create table brd_fc_settings(farm_id bigint, feed_group_id bigint, void text);
create table inventory_postings(id bigint generated always as identity primary key, source_doc_type text,source_docentry bigint,item_code text,warehouse_code text,bin_code text,qty numeric,created_by uuid,ref_type text,ref text,transfer_type text,ref_type2 text,ref2 text);
create table notification_outbox(id bigint generated always as identity, module_key text,event_key text,entity_type text,entity_id text,document_no text,fms_type text,farm_id bigint,recipient_farm_id bigint,actor_auth_id uuid,target_url text,permission_group text,permission_title text,title text,message text,priority text,metadata jsonb,dedupe_key text unique,occurred_at timestamptz);
create table if not exists public.brd_fc (
  id bigint generated always as identity not null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_by uuid null,
  updated_at timestamp with time zone null,
  fc_no text not null,
  card_no text null,
  fc_date date not null default current_date,
  farm_id bigint null,
  farm_code text null,
  farm_name text null,
  building_id bigint null,
  building_whse_id bigint null,
  building_src text null,
  building_key text null,
  building_code text null,
  building_name text null,
  building_status text null,
  feed_whse_id bigint null,
  feed_whse_code text null,
  feed_whse_name text null,
  animal_qty numeric(18, 6) not null default 0,
  actual_age integer null,
  status text not null default 'Draft',
  remarks text null,
  void text not null default '1',
  constraint brd_fc_pkey primary key (id),
  constraint brd_fc_fc_no_key unique (fc_no),
  constraint brd_fc_status_check check (status in ('Draft', 'Posted', 'Cancelled')),
  constraint brd_fc_building_src_check check (building_src is null or building_src in ('BUILDING', 'WAREHOUSE')),
  constraint brd_fc_void_check check (void in ('0', '1')),
  constraint brd_fc_animal_qty_check check (animal_qty >= 0),
  constraint brd_fc_actual_age_check check (actual_age is null or actual_age >= 0),
  constraint brd_fc_farm_id_fkey foreign key (farm_id) references public.farms (id),
  constraint brd_fc_building_id_fkey foreign key (building_id) references public.farm_buildings (id),
  constraint brd_fc_building_whse_id_fkey foreign key (building_whse_id) references public.i_warehouse (id),
  constraint brd_fc_feed_whse_id_fkey foreign key (feed_whse_id) references public.i_warehouse (id),
  constraint brd_fc_created_by_fkey foreign key (created_by) references auth.users (id),
  constraint brd_fc_updated_by_fkey foreign key (updated_by) references auth.users (id)
);

create table if not exists public.brd_fc_line (
  id bigint generated always as identity not null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_by uuid null,
  updated_at timestamp with time zone null,
  fc_id bigint not null,
  age integer not null,
  mort_am numeric(18, 6) null,
  mort_pm numeric(18, 6) null,
  mort_total numeric(18, 6) null,
  thin_am numeric(18, 6) null,
  thin_pm numeric(18, 6) null,
  row_total numeric(18, 6) null,
  cum_total numeric(18, 6) null,
  feed_kg numeric(18, 6) null,
  feed_bird numeric(18, 6) null,
  feed_guideline numeric(18, 6) null,
  feed_batch_text text null,
  water_l numeric(18, 6) null,
  water_bird numeric(18, 6) null,
  body_wt numeric(18, 6) null,
  body_guideline numeric(18, 6) null,
  temp_min numeric(18, 6) null,
  temp_max numeric(18, 6) null,
  hum_min numeric(18, 6) null,
  hum_max numeric(18, 6) null,
  nh3_max numeric(18, 6) null,
  skin_b numeric(18, 6) null,
  skin_a numeric(18, 6) null,
  skin_l numeric(18, 6) null,
  extra jsonb not null default '{}'::jsonb,
  is_locked boolean not null default false,
  reversed_at timestamp with time zone null,
  reversed_by uuid null,
  reversal_reason text null,
  void text not null default '1',
  constraint brd_fc_line_pkey primary key (id),
  constraint brd_fc_line_void_check check (void in ('0', '1')),
  constraint brd_fc_line_age_check check (age >= 0),
  constraint brd_fc_line_nonneg_check check (
    coalesce(mort_am, 0) >= 0
    and coalesce(mort_pm, 0) >= 0
    and coalesce(mort_total, 0) >= 0
    and coalesce(thin_am, 0) >= 0
    and coalesce(thin_pm, 0) >= 0
    and coalesce(row_total, 0) >= 0
    and coalesce(cum_total, 0) >= 0
    and coalesce(feed_kg, 0) >= 0
    and coalesce(feed_bird, 0) >= 0
    and coalesce(feed_guideline, 0) >= 0
    and coalesce(water_l, 0) >= 0
    and coalesce(water_bird, 0) >= 0
    and coalesce(body_wt, 0) >= 0
    and coalesce(body_guideline, 0) >= 0
    and coalesce(nh3_max, 0) >= 0
  ),
  constraint brd_fc_line_fc_id_fkey foreign key (fc_id) references public.brd_fc (id) on delete cascade,
  constraint brd_fc_line_created_by_fkey foreign key (created_by) references auth.users (id),
  constraint brd_fc_line_updated_by_fkey foreign key (updated_by) references auth.users (id),
  constraint brd_fc_line_reversed_by_fkey foreign key (reversed_by) references auth.users (id)
);

create table if not exists public.brd_fc_ba (
  id bigint generated always as identity not null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_by uuid null,
  updated_at timestamp with time zone null,
  fc_line_id bigint not null,
  line_no integer not null,
  item_id bigint null,
  item_code text not null,
  item_name text null,
  batch_no text not null,
  whse_id bigint null,
  whse_code text not null,
  whse_name text null,
  alloc_qty numeric(18, 6) not null default 0,
  onhand_snapshot numeric(18, 6) not null default 0,
  mfg_date date null,
  exp_date date null,
  source text not null default 'MANUAL',
  reversed_at timestamp with time zone null,
  reversed_by uuid null,
  reversal_reason text null,
  void text not null default '1',
  constraint brd_fc_ba_pkey primary key (id),
  constraint brd_fc_ba_source_check check (source in ('MANUAL', 'FIFO')),
  constraint brd_fc_ba_void_check check (void in ('0', '1')),
  constraint brd_fc_ba_qty_check check (alloc_qty >= 0 and onhand_snapshot >= 0),
  constraint brd_fc_ba_fc_line_id_fkey foreign key (fc_line_id) references public.brd_fc_line (id) on delete cascade,
  constraint brd_fc_ba_item_id_fkey foreign key (item_id) references public.items (id),
  constraint brd_fc_ba_whse_id_fkey foreign key (whse_id) references public.i_warehouse (id),
  constraint brd_fc_ba_created_by_fkey foreign key (created_by) references auth.users (id),
  constraint brd_fc_ba_updated_by_fkey foreign key (updated_by) references auth.users (id),
  constraint brd_fc_ba_reversed_by_fkey foreign key (reversed_by) references auth.users (id)
);


create unique index on brd_fc_line(fc_id,age) where void='1';
insert into farms values(61,'FRM000062', 'Test farm','BR',array['{"whse_code":"FEEDS","is_default_feed":true}'::jsonb]);
insert into item_groups values(29,20,'1');
insert into brd_fc_settings values(61,null,'1');
insert into items values(1,'FEED','Feed item',null,29,99,'1'),(2,'WRONG','Other item',null,29,99,'1');
insert into inventory_postings(item_code,warehouse_code,qty,ref,transfer_type) values('FEED','FEEDS',100,'FD-2609-2709-002','IN');
-- Probe trigger models a mortality side effect before feed validation.
create function probe_mortality() returns trigger language plpgsql as $$begin
 if new.mort_total > 0 then insert into inventory_postings(source_doc_type,source_docentry,qty) values('TEST_MORTALITY',new.id,new.mort_total); end if;
 return new; end;$$;
create trigger probe_mortality after insert or update on brd_fc_line for each row execute function probe_mortality();
