-- Deploy after the current Broiler Cycle Master, DOC Placement, Growing,
-- Harvest & Delivery, Clean Up, and centralized notification migrations.
-- In particular, apply app/sql/new/alter_growing_harvest_age.sql and then
-- app/sql/new/alter_br_delivery_lines_add_average_live_weight.sql first.
begin;
set local lock_timeout = '15s';

-- DTW supports databases created before Cycle Master introduced cycle_key.
-- Keep cycle_no as the numeric ordering key and use cycle_key as the exact
-- business/display value (including LEGACY-MMDDYYYY-000 values).
do $$
declare v_missing_harvest_columns text[];
begin
  if to_regclass('public.doc_farm_cycles') is null then
    raise exception 'Deploy the Broiler Cycle Master schema before Data Transfer Workbench.';
  end if;
  if to_regclass('public.br_delivery_lines') is null then
    raise exception 'Deploy the Harvest & Delivery schema before Data Transfer Workbench.';
  end if;
  select array_agg(required.column_name order by required.column_name)
  into v_missing_harvest_columns
  from (values ('harvest_age'),('average_live_weight'),('net_live_weight')) required(column_name)
  where not exists (
    select 1 from information_schema.columns existing
    where existing.table_schema='public' and existing.table_name='br_delivery_lines' and existing.column_name=required.column_name
  );
  if coalesce(cardinality(v_missing_harvest_columns),0)>0 then
    raise exception 'Missing public.br_delivery_lines columns: %. Apply alter_growing_harvest_age.sql, alter_br_delivery_lines_add_average_live_weight.sql, and the current Harvest & Delivery migrations before Data Transfer Workbench.',array_to_string(v_missing_harvest_columns,', ');
  end if;
end;
$$;

alter table public.doc_farm_cycles
  add column if not exists cycle_key text,
  add column if not exists cycle_mask text;

commit;

-- Keep lock-heavy schema changes in short, rerunnable phases. PostgreSQL holds
-- table locks until transaction end, so one migration-wide transaction can
-- deadlock with normal Broiler activity.
begin;
set local lock_timeout = '15s';

update public.doc_farm_cycles
set cycle_key = cycle_no::text
where nullif(btrim(cycle_key), '') is null;

commit;

begin;
set local lock_timeout = '15s';

alter table public.doc_farm_cycles alter column cycle_key set not null;

create unique index if not exists doc_farm_cycles_farm_cycle_key_uidx
on public.doc_farm_cycles(farm_id, cycle_key);

create or replace function public.set_doc_farm_cycle_key()
returns trigger language plpgsql security invoker set search_path = public
as $$
begin
  new.cycle_key := coalesce(nullif(btrim(new.cycle_key), ''), new.cycle_no::text);
  return new;
end;
$$;
drop trigger if exists set_doc_farm_cycle_key on public.doc_farm_cycles;
create trigger set_doc_farm_cycle_key
before insert or update of cycle_no, cycle_key on public.doc_farm_cycles
for each row execute function public.set_doc_farm_cycle_key();
revoke all on function public.set_doc_farm_cycle_key() from public, anon, authenticated;

commit;

begin;
set local lock_timeout = '15s';

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.broiler_dtw_import_jobs (
  id uuid primary key,
  actor_auth_id uuid not null references auth.users(id),
  mode text not null check (mode in ('standard', 'legacy')),
  file_name text not null,
  payload_hash text not null,
  status text not null default 'Completed' check (status in ('Completed', 'Failed')),
  cycle_count integer not null default 0,
  placement_count integer not null default 0,
  growing_count integer not null default 0,
  harvest_count integer not null default 0,
  cleanup_count integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.broiler_dtw_cycle_links (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.broiler_dtw_import_jobs(id) on delete cascade,
  import_cycle_key text not null,
  farm_id bigint not null references public.farms(id),
  building_whse_id bigint not null references public.i_warehouse(id),
  placement_date date,
  farm_cycle_id bigint not null references public.doc_farm_cycles(id),
  flock_card_id bigint not null references public.flock_card(id),
  cycle_key text not null,
  created_at timestamptz not null default now(),
  unique(job_id, import_cycle_key)
);

alter table public.broiler_dtw_cycle_links add column if not exists placement_date date;
create index if not exists broiler_dtw_cycle_links_placement_lookup_idx
on public.broiler_dtw_cycle_links(job_id, farm_id, building_whse_id, placement_date);

create table if not exists public.broiler_dtw_import_rows (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.broiler_dtw_import_jobs(id) on delete cascade,
  stage text not null check (stage in ('DOC Placement', 'Growing', 'Harvest Delivery', 'Clean Up')),
  row_no integer not null,
  farm_id bigint not null references public.farms(id),
  building_whse_id bigint not null references public.i_warehouse(id),
  farm_cycle_id bigint not null references public.doc_farm_cycles(id),
  entity_id bigint,
  raw_data jsonb not null,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(job_id, stage, row_no)
);

alter table public.broiler_dtw_import_jobs enable row level security;
alter table public.broiler_dtw_cycle_links enable row level security;
alter table public.broiler_dtw_import_rows enable row level security;

drop policy if exists broiler_dtw_jobs_own on public.broiler_dtw_import_jobs;
create policy broiler_dtw_jobs_own on public.broiler_dtw_import_jobs for select to authenticated
using (actor_auth_id = (select auth.uid()));

drop policy if exists broiler_dtw_cycle_links_own on public.broiler_dtw_cycle_links;
create policy broiler_dtw_cycle_links_own on public.broiler_dtw_cycle_links for select to authenticated
using (exists(select 1 from public.broiler_dtw_import_jobs job where job.id = job_id and job.actor_auth_id = (select auth.uid())));

drop policy if exists broiler_dtw_rows_own on public.broiler_dtw_import_rows;
create policy broiler_dtw_rows_own on public.broiler_dtw_import_rows for select to authenticated
using (exists(select 1 from public.broiler_dtw_import_jobs job where job.id = job_id and job.actor_auth_id = (select auth.uid())));

revoke all on public.broiler_dtw_import_jobs, public.broiler_dtw_cycle_links, public.broiler_dtw_import_rows from public, anon;
grant select on public.broiler_dtw_import_jobs, public.broiler_dtw_cycle_links, public.broiler_dtw_import_rows to authenticated;

commit;

begin;
set local lock_timeout = '15s';

create or replace function private.broiler_dtw_good_doc_item(p_farm_id bigint)
returns table(item_id bigint, item_code text, item_name text)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  return query
  select item.id, item.item_code, item.item_name
  from public.doc_rec_settings settings
  join public.items item on item.id=settings.good_doc and coalesce(btrim(item.void::text),'1')='1'
  where settings.farm_id=p_farm_id and coalesce(btrim(settings.void::text),'1')='1'
  order by settings.created_at desc nulls last, settings.id desc
  limit 1;
  if not found then
    raise exception 'Farm % requires an active DOC Placement setting with a valid Good DOC item.',p_farm_id;
  end if;
end;
$$;
revoke all on function private.broiler_dtw_good_doc_item(bigint) from public, anon, authenticated;

create or replace function private.broiler_dtw_assert_access(p_farm_id bigint)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := auth.uid(); v_user public.users%rowtype;
begin
  if v_actor is null then raise exception 'An authenticated user is required to use Data Transfer Workbench.' using errcode='42501'; end if;
  select * into v_user from public.users where auth_id=v_actor and coalesce(btrim(isactive::text),'1')='1';
  if not found then raise exception 'The signed-in user profile is inactive or missing.' using errcode='42501'; end if;
  if coalesce(v_user.user_type,3)<>1 and not exists(
    select 1 from public.user_permissions p where p.user_id=v_actor and p.ilink='/brd/dtw/view' and p.is_visible
  ) then raise exception 'You do not have permission to use Data Transfer Workbench.' using errcode='42501'; end if;
  if coalesce(v_user.user_type,3)<>1 and not exists(
    select 1 from public.users_farms uf where uf.users_id=v_user.id and uf.farm_id=p_farm_id and coalesce(btrim(uf.void::text),'1')='1'
  ) then raise exception 'You do not have access to farm %.',p_farm_id using errcode='42501'; end if;
end;
$$;
revoke all on function private.broiler_dtw_assert_access(bigint) from public, anon, authenticated;

create or replace function private.broiler_dtw_resolve_context(p_job_id uuid, p_row jsonb)
returns table(
  farm_id bigint, farm_code text, farm_name text,
  building_id bigint, building_code text, building_name text,
  cycle_id bigint, cycle_key text, flock_card_id bigint
) language plpgsql security definer set search_path = public, pg_temp as $$
declare v_farm public.farms%rowtype; v_building public.i_warehouse%rowtype; v_cycle public.doc_farm_cycles%rowtype; v_card public.flock_card%rowtype;
begin
  if nullif(p_row->>'placementDate','') is null then raise exception 'Placement Date is required to resolve the Broiler cycle.'; end if;
  select * into v_farm from public.farms f where upper(btrim(f.code))=upper(btrim(p_row->>'farmCode')) and coalesce(btrim(f.void::text),'1')='1';
  if not found or upper(btrim(coalesce(v_farm.farm_type,''))) not in ('BR','BROILER') then raise exception 'Farm % was not found, inactive, or is not Broiler.',coalesce(p_row->>'farmCode','<blank>'); end if;
  perform private.broiler_dtw_assert_access(v_farm.id);
  select * into v_building from public.i_warehouse w where upper(btrim(w.whse_code))=upper(btrim(p_row->>'buildingCode'))
    and coalesce(w.is_active,true) and (w.farm_id::text=v_farm.id::text or upper(btrim(coalesce(w.farm_code,'')))=upper(btrim(v_farm.code))) limit 1;
  if not found then raise exception 'Building % does not belong to farm %.',coalesce(p_row->>'buildingCode','<blank>'),v_farm.code; end if;
  if nullif(btrim(p_row->>'existingCycleKey'),'') is not null then
    select * into v_cycle from public.doc_farm_cycles c where c.farm_id=v_farm.id and upper(btrim(c.cycle_key))=upper(btrim(p_row->>'existingCycleKey'));
    if not found then raise exception 'Legacy cycle % was not found for farm %.',p_row->>'existingCycleKey',v_farm.code; end if;
    select * into v_card from public.flock_card c where c.farm_cycle_id=v_cycle.id and c.farm_id=v_farm.id and c.building_whse_id=v_building.id and c.void='1' order by c.id desc limit 1;
  else
    if nullif(btrim(p_row->>'importCycleKey'),'') is not null then
      select c.* into v_cycle from public.broiler_dtw_cycle_links link join public.doc_farm_cycles c on c.id=link.farm_cycle_id
        where link.job_id=p_job_id and upper(link.import_cycle_key)=upper(btrim(p_row->>'importCycleKey'));
      select card.* into v_card from public.broiler_dtw_cycle_links link join public.flock_card card on card.id=link.flock_card_id
        where link.job_id=p_job_id and upper(link.import_cycle_key)=upper(btrim(p_row->>'importCycleKey'));
    else
      select c.* into v_cycle from public.broiler_dtw_cycle_links link join public.doc_farm_cycles c on c.id=link.farm_cycle_id
        where link.job_id=p_job_id and link.farm_id=v_farm.id and link.building_whse_id=v_building.id and link.placement_date=nullif(p_row->>'placementDate','')::date;
      select card.* into v_card from public.broiler_dtw_cycle_links link join public.flock_card card on card.id=link.flock_card_id
        where link.job_id=p_job_id and link.farm_id=v_farm.id and link.building_whse_id=v_building.id and link.placement_date=nullif(p_row->>'placementDate','')::date;
      if v_cycle.id is null then
        select c.* into v_cycle from public.doc_farm_cycles c
        join public.flock_card card on card.farm_cycle_id=c.id and card.farm_id=v_farm.id and card.building_whse_id=v_building.id and card.void='1'
        where c.farm_id=v_farm.id and upper(btrim(c.cycle_key)) like 'LEGACY-%' and card.start_date=nullif(p_row->>'placementDate','')::date
        order by c.id desc limit 1;
        if v_cycle.id is not null then
          select * into v_card from public.flock_card card where card.farm_cycle_id=v_cycle.id and card.farm_id=v_farm.id
            and card.building_whse_id=v_building.id and card.start_date=nullif(p_row->>'placementDate','')::date and card.void='1' order by card.id desc limit 1;
        end if;
      end if;
    end if;
  end if;
  if v_cycle.id is null or v_card.id is null then raise exception 'The row cannot be linked to a DOC Placement cycle.'; end if;
  if v_cycle.farm_id<>v_farm.id then raise exception 'The selected cycle belongs to another farm.'; end if;
  if v_card.building_whse_id<>v_building.id then raise exception 'The selected cycle belongs to another building.'; end if;
  if v_card.status<>'Saved' then raise exception 'The selected building cycle is already closed by Clean Up.'; end if;
  return query select v_farm.id,v_farm.code,v_farm.name,v_building.id,v_building.whse_code,v_building.whse_name,v_cycle.id,v_cycle.cycle_key,v_card.id;
end;
$$;
revoke all on function private.broiler_dtw_resolve_context(uuid,jsonb) from public, anon, authenticated;

create or replace function private.import_broiler_dtw_workbook(p_request_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  v_actor uuid:=auth.uid(); v_mode text:=lower(coalesce(p_payload->>'mode','standard')); v_legacy boolean;
  v_hash text:=md5(p_payload::text); v_existing public.broiler_dtw_import_jobs%rowtype; v_row jsonb; v_context record;
  v_farm public.farms%rowtype; v_building public.i_warehouse%rowtype; v_cycle public.doc_farm_cycles%rowtype;
  v_card_id bigint; v_receipt_id bigint; v_detail_id bigint; v_growing_id bigint; v_line_id bigint; v_document_id bigint; v_ba_id bigint;
  v_index integer:=0; v_internal_cycle bigint; v_daily_cycle_count bigint; v_cycle_key text; v_card_no text; v_doc_no text; v_batch text; v_item text; v_qty numeric; v_on_hand numeric;
  v_good_doc record; v_allocation record; v_remaining numeric; v_alloc_qty numeric; v_line_no integer; v_mortality_total numeric; v_row_total numeric; v_cumulative_total numeric; v_feed_per_bird numeric; v_animal_qty numeric;
  v_date date; v_result jsonb; v_warnings jsonb:=coalesce(p_payload->'warnings','[]'::jsonb);
  v_cycle_count integer:=0; v_placement_count integer:=0; v_growing_count integer:=0; v_harvest_count integer:=0; v_cleanup_count integer:=0;
begin
  if v_actor is null then raise exception 'An authenticated user is required to import a workbook.' using errcode='42501'; end if;
  if p_request_id is null then raise exception 'An import request identity is required.'; end if;
  if v_mode not in ('standard','legacy') then raise exception 'DTW mode must be standard or legacy.'; end if;
  v_legacy:=v_mode='legacy';
  if jsonb_typeof(p_payload->'placement') is distinct from 'array' or jsonb_typeof(p_payload->'growing') is distinct from 'array'
    or jsonb_typeof(p_payload->'harvest') is distinct from 'array' or jsonb_typeof(p_payload->'cleanup') is distinct from 'array' then
    raise exception 'The workbook payload is incomplete.';
  end if;
  if jsonb_array_length(p_payload->'placement')+jsonb_array_length(p_payload->'growing')+jsonb_array_length(p_payload->'harvest')+jsonb_array_length(p_payload->'cleanup')=0 then
    raise exception 'The workbook contains no import rows.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into v_existing from public.broiler_dtw_import_jobs where id=p_request_id;
  if found then
    if v_existing.actor_auth_id<>v_actor or v_existing.payload_hash<>v_hash then raise exception 'Import request ownership or content mismatch.' using errcode='42501'; end if;
    return v_existing.result;
  end if;
  insert into public.broiler_dtw_import_jobs(id,actor_auth_id,mode,file_name,payload_hash)
  values(p_request_id,v_actor,v_mode,coalesce(nullif(btrim(p_payload->>'fileName'),''),'broiler-dtw.xlsx'),v_hash);
  if v_legacy then
    perform set_config('app.broiler_dtw_suppress_notifications','on',true);
    perform set_config('app.broiler_dtw_legacy_allow_mort_thin_imbalance','on',true);
  end if;

  -- Stage 1: DOC Placement creates the Cycle Master and building flock card.
  for v_row in select value from jsonb_array_elements(p_payload->'placement') loop
    v_index:=v_index+1;
    if nullif(v_row->>'placementDate','') is null or nullif(v_row->>'quantityReceived','') is null or nullif(v_row->>'actualReceived','') is null then
      raise exception 'DOC Placement row % requires Placement Date, Quantity Received, and Actual Received.',v_index;
    end if;
    select * into v_farm from public.farms f where upper(btrim(f.code))=upper(btrim(v_row->>'farmCode')) and coalesce(btrim(f.void::text),'1')='1';
    if not found or upper(btrim(coalesce(v_farm.farm_type,''))) not in ('BR','BROILER') then raise exception 'DOC Placement row % has an invalid Broiler Farm.',v_index; end if;
    perform private.broiler_dtw_assert_access(v_farm.id);
    select * into v_building from public.i_warehouse w where upper(btrim(w.whse_code))=upper(btrim(v_row->>'buildingCode')) and coalesce(w.is_active,true)
      and (w.farm_id::text=v_farm.id::text or upper(btrim(coalesce(w.farm_code,'')))=upper(btrim(v_farm.code))) limit 1;
    if not found then raise exception 'DOC Placement row % has an invalid Building for farm %.',v_index,v_farm.code; end if;
    v_date:=coalesce(nullif(v_row->>'placementDate','')::date,current_date);
    if nullif(btrim(v_row->>'existingCycleKey'),'') is not null then raise exception 'DOC Placement creates a new Legacy cycle and cannot use Existing Legacy Cycle.'; end if;
    perform pg_advisory_xact_lock(73191,v_farm.id::integer);
    select coalesce(max(c.cycle_no),0)+1 into v_internal_cycle from public.doc_farm_cycles c where c.farm_id=v_farm.id;
    select count(*)+1 into v_daily_cycle_count from public.doc_farm_cycles c
    where c.farm_id=v_farm.id and (
      upper(c.cycle_key) like format('LEGACY-%s__%s-%%',to_char(v_date,'MM'),to_char(v_date,'YYYY'))
      or upper(c.cycle_key) like format('LEGACY-%s__%s-%%',to_char(v_date,'MM'),to_char(v_date,'YY'))
    );
    v_cycle_key:=format('LEGACY-%s-%s',to_char(v_date,'MMDDYYYY'),lpad(v_daily_cycle_count::text,3,'0'));
    if exists(select 1 from public.doc_farm_cycles c where c.farm_id=v_farm.id and upper(c.cycle_key)=upper(v_cycle_key)) then raise exception 'Cycle % already exists. Use it from Existing Legacy Cycle in a continuation workbook.',v_cycle_key; end if;
    if exists(select 1 from public.flock_card c where c.farm_id=v_farm.id and c.building_whse_id=v_building.id and c.void='1' and c.status='Saved') then
      raise exception 'Building % already has an open cycle. Finish its Clean Up before importing another Placement.',v_building.whse_code;
    end if;
    insert into public.doc_farm_cycles(farm_id,cycle_no,cycle_key,cycle_mask,status,created_by,created_at)
      values(v_farm.id,v_internal_cycle,v_cycle_key,v_cycle_key,'Past Open',v_actor,v_date) returning * into v_cycle;
    v_card_no:=format('DTW-%s-%s',replace(p_request_id::text,'-',''),lpad(v_index::text,4,'0'));
    v_qty:=coalesce(nullif(v_row->>'actualReceived','')::numeric,nullif(v_row->>'quantityReceived','')::numeric,0);
    insert into public.flock_card(created_by,created_at,card_no,farm_id,farm_cycle_id,farm_code,farm_name,building_whse_id,building_src,building_key,
      building_code,building_name,start_date,cycle_no,animal_qty,status,remarks,extra,void)
    values(v_actor,v_date,v_card_no,v_farm.id,v_cycle.id,v_farm.code,v_farm.name,v_building.id,'WAREHOUSE','WAREHOUSE:'||v_building.id,
      v_building.whse_code,v_building.whse_name,v_date,v_cycle_key,greatest(v_qty,0),'Saved',nullif(v_row->>'remarks',''),
      jsonb_build_object('createdFrom','BROILER_DTW','dtwJobId',p_request_id,'legacy',v_legacy),'1') returning id into v_card_id;
    select * into v_good_doc from private.broiler_dtw_good_doc_item(v_farm.id);
    v_item:=v_good_doc.item_code;
    v_doc_no:=format('DTW-DOC-%s-%s',to_char(v_date,'YY'),lpad(v_index::text,6,'0'))||'-'||left(replace(p_request_id::text,'-',''),6);
    insert into public.goods_receipt(created_by,created_at,gr_no,dr_reference,vendor,receive_date,fms_type,farm_id,farm_code,farm_name,default_warehouse_id,status,remarks)
      values(v_actor,v_date,v_doc_no,'LEGACY','LEGACY',v_date,'broiler',v_farm.id,v_farm.code,v_farm.name,v_building.id,'Posted',nullif(v_row->>'remarks','')) returning id into v_receipt_id;
    v_batch:=public.receiving_new_batch('broiler',v_receipt_id,'DTW:'||v_card_id,v_item,v_date,null,null);
    insert into public.flock_card_origin(created_by,fc_id,line_no,item_id,item_code,item_name,batch_no,whse_id,whse_code,whse_name,animal_qty,onhand_snapshot,mfg_date,extra,void)
      values(v_actor,v_card_id,1,v_good_doc.item_id,v_item,v_good_doc.item_name,v_batch,v_building.id,v_building.whse_code,v_building.whse_name,greatest(v_qty,0),greatest(v_qty,0),v_date,
        jsonb_build_object('dtwJobId',p_request_id,'legacy',v_legacy),'1');
    insert into public.goods_receipt_doc(created_by,goods_reciept_id,line_no,receive_date,mnf_date,doc_source,building_warehouse_id,flock_card_id,average_doc_weight,
      quantity_received,actual_received,doa_quantity,reject_count,void)
      values(v_actor,v_receipt_id,1,v_date,v_date,'LEGACY',v_building.id,v_card_id,coalesce(nullif(v_row->>'averageDocWeight','')::numeric,0),
        coalesce(nullif(v_row->>'quantityReceived','')::numeric,v_qty),v_qty,coalesce(nullif(v_row->>'doaCount','')::numeric,0),coalesce(nullif(v_row->>'rejectCount','')::numeric,0),'1') returning id into v_detail_id;
    insert into public.goods_receipt_items(created_by,goods_reciept_id,line_no,receive_date,item_id,item_code,description,batch_number,manufacturing_date,alt_qty,alt_uom,base_qty,base_uom,
      warehouse_id,warehouse_code,warehouse_name,doc_line_no,void)
      values(v_actor,v_receipt_id,1,v_date,v_good_doc.item_id,v_item,v_good_doc.item_name,v_batch,v_date,greatest(v_qty,0),'EA',greatest(v_qty,0),'EA',
        v_building.id,v_building.whse_code,v_building.whse_name,1,'1');
    if v_qty>0 then insert into public.inventory_postings(source_doc_type,source_docentry,item_code,warehouse_code,bin_code,qty,created_by,ref_type,ref,batch_number,transfer_type,ref_type2,ref2)
      values('GOODS_RECEIPT',v_receipt_id,v_item,v_building.whse_code,'MAIN SUB BIN',v_qty,v_actor,'batch_code',v_batch,v_batch,'IN','BROILER_DTW',v_cycle_key); end if;
    insert into public.broiler_dtw_cycle_links(job_id,import_cycle_key,farm_id,building_whse_id,placement_date,farm_cycle_id,flock_card_id,cycle_key)
      values(p_request_id,coalesce(nullif(btrim(v_row->>'importCycleKey'),''),format('__AUTO__:%s:%s:%s',v_farm.id,v_building.id,to_char(v_date,'YYYYMMDD'))),v_farm.id,v_building.id,v_date,v_cycle.id,v_card_id,v_cycle_key);
    insert into public.broiler_dtw_import_rows(job_id,stage,row_no,farm_id,building_whse_id,farm_cycle_id,entity_id,raw_data)
      values(p_request_id,'DOC Placement',v_index,v_farm.id,v_building.id,v_cycle.id,v_receipt_id,v_row);
    v_cycle_count:=v_cycle_count+1; v_placement_count:=v_placement_count+1;
  end loop;

  -- Stage 2: Growing. Later Growing rows remain allowed after Harvest.
  v_index:=0;
  for v_row in select value from jsonb_array_elements(p_payload->'growing') loop
    v_index:=v_index+1; select * into v_context from private.broiler_dtw_resolve_context(p_request_id,v_row); v_date:=coalesce(nullif(v_row->>'entryDate','')::date,current_date);
    if nullif(v_row->>'entryDate','') is null or nullif(v_row->>'age','') is null or nullif(v_row->>'mortalityAm','') is null then
      raise exception 'Growing row % requires Entry Date, Age, and Mortality AM.',v_index;
    end if;
    select id into v_growing_id from public.brd_fc where card_no=(select card_no from public.flock_card where id=v_context.flock_card_id) and void='1' order by id desc limit 1;
    if v_growing_id is null then
      insert into public.brd_fc(created_by,fc_no,card_no,fc_date,farm_id,farm_code,farm_name,building_whse_id,building_src,building_key,building_code,building_name,building_status,animal_qty,status,remarks,void)
      select v_actor,format('DTW-FC-%s-%s',left(replace(p_request_id::text,'-',''),8),v_context.flock_card_id),card.card_no,coalesce(nullif(v_row->>'entryDate','')::date,card.start_date),
        v_context.farm_id,v_context.farm_code,v_context.farm_name,v_context.building_id,'WAREHOUSE','WAREHOUSE:'||v_context.building_id,v_context.building_code,v_context.building_name,'Saved',card.animal_qty,'Posted','Imported by Data Transfer Workbench','1'
      from public.flock_card card where card.id=v_context.flock_card_id returning id into v_growing_id;
    end if;
    if exists(select 1 from public.brd_fc_line line where line.fc_id=v_growing_id and line.age=coalesce(nullif(v_row->>'age','')::integer,0) and line.void='1') then
      raise exception 'Growing row % duplicates Age % in cycle %.',v_index,v_row->>'age',v_context.cycle_key;
    end if;
    v_mortality_total:=coalesce(nullif(v_row->>'mortalityAm','')::numeric,0)+coalesce(nullif(v_row->>'mortalityPm','')::numeric,0);
    v_row_total:=v_mortality_total+coalesce(nullif(v_row->>'thinningAm','')::numeric,0)+coalesce(nullif(v_row->>'thinningPm','')::numeric,0);
    select coalesce(sum(line.row_total),0)+v_row_total into v_cumulative_total from public.brd_fc_line line where line.fc_id=v_growing_id and line.void='1';
    select animal_qty into v_animal_qty from public.flock_card where id=v_context.flock_card_id;
    v_feed_per_bird:=case when coalesce(v_animal_qty,0)-v_cumulative_total>0 then coalesce(nullif(v_row->>'feedKg','')::numeric,0)*1000/(v_animal_qty-v_cumulative_total) else 0 end;
    insert into public.brd_fc_line(created_by,fc_id,age,mort_am,mort_pm,mort_total,thin_am,thin_pm,row_total,cum_total,feed_kg,feed_bird,feed_batch_text,water_l,water_bird,
      body_wt,temp_min,temp_max,hum_min,hum_max,nh3_max,extra,void)
    values(v_actor,v_growing_id,coalesce(nullif(v_row->>'age','')::integer,0),nullif(v_row->>'mortalityAm','')::numeric,nullif(v_row->>'mortalityPm','')::numeric,
      v_mortality_total,nullif(v_row->>'thinningAm','')::numeric,nullif(v_row->>'thinningPm','')::numeric,v_row_total,v_cumulative_total,
      nullif(v_row->>'feedKg','')::numeric,v_feed_per_bird,null,nullif(v_row->>'waterLiters','')::numeric,nullif(v_row->>'waterPerBird','')::numeric,
      nullif(v_row->>'bodyWeight','')::numeric,nullif(v_row->>'tempMin','')::numeric,nullif(v_row->>'tempMax','')::numeric,nullif(v_row->>'humidityMin','')::numeric,nullif(v_row->>'humidityMax','')::numeric,
      nullif(v_row->>'nh3Max','')::numeric,jsonb_build_object('dtwJobId',p_request_id,'entryDate',v_row->>'entryDate','legacy',v_legacy,'remarks',v_row->>'remarks'),'1') returning id into v_line_id;
    update public.brd_fc set actual_age=greatest(coalesce(actual_age,0),coalesce(nullif(v_row->>'age','')::integer,0)),updated_by=v_actor where id=v_growing_id;
    v_qty:=coalesce(nullif(v_row->>'feedKg','')::numeric,0);
    if v_qty>0 then
      with historical_usage as (
        select upper(btrim(item_code)) item_key,sum(qty) used_qty from public.inventory_postings
        where source_doc_type='BRD_FC_FEED_USAGE' and transfer_type='OUT' group by upper(btrim(item_code))
      ), available as (
        select min(item_code) item_code,upper(btrim(item_code)) item_key
        from public.inventory_postings where upper(btrim(warehouse_code))=upper(btrim(v_context.building_code))
        group by upper(btrim(item_code)) having sum(case when transfer_type='OUT' then -qty else qty end)>0
      )
      select available.item_code into v_item from available join historical_usage using(item_key)
      order by historical_usage.used_qty desc,available.item_code limit 1;
      if v_item is null then raise exception 'Growing row % cannot find an historically used feed item with stock in building %.',v_index,v_context.building_code; end if;
      perform pg_advisory_xact_lock(hashtextextended('inventory:'||upper(v_item)||':'||upper(v_context.building_code),0));
      select coalesce(sum(case when transfer_type='OUT' then -qty else qty end),0) into v_on_hand from public.inventory_postings where upper(item_code)=upper(v_item) and upper(warehouse_code)=upper(v_context.building_code);
      if v_on_hand<v_qty then raise exception 'Growing row % needs % kg of %, but building % has only %.',v_index,v_qty,v_item,v_context.building_code,v_on_hand; end if;
      v_remaining:=v_qty; v_line_no:=0;
      for v_allocation in
        select coalesce(posting.batch_number,posting.ref) batch_number,
          sum(case when posting.transfer_type='OUT' then -posting.qty else posting.qty end) on_hand,
          min(batch.manufacturing_date) manufacturing_date,min(batch.expiry_date) expiry_date
        from public.inventory_postings posting
        left join public.item_batches batch on upper(batch.item_code)=upper(posting.item_code) and upper(batch.batch_number)=upper(coalesce(posting.batch_number,posting.ref)) and batch.void='1'
        where upper(posting.item_code)=upper(v_item) and upper(posting.warehouse_code)=upper(v_context.building_code) and nullif(btrim(coalesce(posting.batch_number,posting.ref)),'') is not null
        group by coalesce(posting.batch_number,posting.ref)
        having sum(case when posting.transfer_type='OUT' then -posting.qty else posting.qty end)>0
        order by min(batch.expiry_date) nulls last,min(batch.manufacturing_date) nulls last,coalesce(posting.batch_number,posting.ref)
      loop
        exit when v_remaining<=0; v_line_no:=v_line_no+1; v_alloc_qty:=least(v_remaining,v_allocation.on_hand); v_batch:=v_allocation.batch_number;
        insert into public.brd_fc_ba(created_by,fc_line_id,line_no,item_id,item_code,item_name,batch_no,whse_id,whse_code,whse_name,alloc_qty,onhand_snapshot,mfg_date,exp_date,source,void)
          select v_actor,v_line_id,v_line_no,i.id,i.item_code,i.item_name,v_batch,v_context.building_id,v_context.building_code,v_context.building_name,v_alloc_qty,v_allocation.on_hand,
            coalesce(v_allocation.manufacturing_date,v_date),v_allocation.expiry_date,'AUTO','1' from public.items i where upper(i.item_code)=upper(v_item) and coalesce(btrim(i.void::text),'1')='1' returning id into v_ba_id;
        insert into public.inventory_postings(source_doc_type,source_docentry,item_code,warehouse_code,bin_code,qty,created_by,ref_type,ref,batch_number,transfer_type,ref_type2,ref2)
          values('BRD_FC_FEED_USAGE',v_ba_id,v_item,v_context.building_code,'MAIN SUB BIN',v_alloc_qty,v_actor,'batch_code',v_batch,v_batch,'OUT','BROILER_DTW',v_context.cycle_key);
        v_remaining:=v_remaining-v_alloc_qty;
      end loop;
      if v_remaining>0 then raise exception 'Growing row % could not allocate % kg of % to an available batch.',v_index,v_remaining,v_item; end if;
      update public.brd_fc_line set feed_batch_text=(select string_agg(item_code||' - '||batch_no,', ' order by line_no) from public.brd_fc_ba where fc_line_id=v_line_id and void='1') where id=v_line_id;
    end if;
    insert into public.broiler_dtw_import_rows(job_id,stage,row_no,farm_id,building_whse_id,farm_cycle_id,entity_id,raw_data)
      values(p_request_id,'Growing',v_index,v_context.farm_id,v_context.building_id,v_context.cycle_id,v_line_id,v_row); v_growing_count:=v_growing_count+1;
  end loop;

  if not v_legacy then
    insert into public.notification_outbox(
      module_key,event_key,entity_type,entity_id,document_no,fms_type,farm_id,recipient_farm_id,
      actor_auth_id,target_url,permission_group,permission_title,title,message,priority,metadata,dedupe_key,occurred_at
    )
    select distinct 'BRD_FC','BRD_FC_POSTED','brd_fc',header.id::text,header.fc_no,'Broiler',header.farm_id,header.farm_id,
      v_actor,'/brd/fc','Menus','Growing & Farm Condition/view','Growing saved',
      'Growing '||header.fc_no||' was imported through Data Transfer Workbench.','normal',
      jsonb_build_object('farm_routing','document','dtwJobId',p_request_id),
      'BRD_FC_POSTED:DTW:'||p_request_id::text||':'||header.id::text,now()
    from public.broiler_dtw_import_rows imported
    join public.brd_fc_line line on line.id=imported.entity_id
    join public.brd_fc header on header.id=line.fc_id
    where imported.job_id=p_request_id and imported.stage='Growing'
    on conflict(dedupe_key) do nothing;
  end if;

  -- Stage 3: Harvest & Delivery.
  v_index:=0;
  for v_row in select value from jsonb_array_elements(p_payload->'harvest') loop
    v_index:=v_index+1; select * into v_context from private.broiler_dtw_resolve_context(p_request_id,v_row); v_date:=coalesce(nullif(v_row->>'deliveryDate','')::date,current_date);
    if nullif(v_row->>'deliveryDate','') is null or nullif(v_row->>'harvestAge','') is null or nullif(v_row->>'quantity','') is null then
      raise exception 'Harvest row % requires Delivery Date, Harvest Age, and Harvest Quantity.',v_index;
    end if;
    if not v_legacy and coalesce(nullif(v_row->>'quantity','')::numeric,0)>0 and nullif(v_row->>'netLiveWeight','') is not null and nullif(v_row->>'averageLiveWeight','') is not null
      and abs((v_row->>'averageLiveWeight')::numeric-(v_row->>'netLiveWeight')::numeric/(v_row->>'quantity')::numeric)>0.0005 then raise exception 'Harvest row % has an ALW mismatch.',v_index; end if;
    v_doc_no:=format('DTW-BRDR-%s-%s-%s',to_char(v_date,'YY'),left(replace(p_request_id::text,'-',''),6),lpad(v_index::text,4,'0'));
    if exists(select 1 from public.br_delivery where gi_no=v_doc_no) then raise exception 'Harvest document % already exists.',v_doc_no; end if;
    insert into public.br_delivery(created_by,created_at,gi_no,issue_date,farm_id,farm_cycle_id,farm_code,farm_name,from_warehouse_id,from_warehouse_code,from_warehouse_name,triggered_by,status,remarks)
      values(v_actor,v_date,v_doc_no,v_date,v_context.farm_id,v_context.cycle_id,v_context.farm_code,v_context.farm_name,v_context.building_id,v_context.building_code,v_context.building_name,'BR-DR','Posted',nullif(v_row->>'remarks','')) returning id into v_document_id;
    select * into v_good_doc from private.broiler_dtw_good_doc_item(v_context.farm_id); v_item:=v_good_doc.item_code; v_qty:=coalesce(nullif(v_row->>'quantity','')::numeric,0);
    perform pg_advisory_xact_lock(hashtextextended('inventory:'||upper(v_item)||':'||upper(v_context.building_code),0));
    select coalesce(sum(case when transfer_type='OUT' then -qty else qty end),0) into v_on_hand from public.inventory_postings where upper(item_code)=upper(v_item) and upper(warehouse_code)=upper(v_context.building_code);
    if v_on_hand<v_qty then raise exception 'Harvest row % needs % of %, but building % has only %.',v_index,v_qty,v_item,v_context.building_code,v_on_hand; end if;
    v_remaining:=v_qty; v_line_no:=0;
    for v_allocation in
      select coalesce(posting.batch_number,posting.ref) batch_number,sum(case when posting.transfer_type='OUT' then -posting.qty else posting.qty end) on_hand,
        min(batch.manufacturing_date) manufacturing_date
      from public.inventory_postings posting left join public.item_batches batch on upper(batch.item_code)=upper(posting.item_code) and upper(batch.batch_number)=upper(coalesce(posting.batch_number,posting.ref)) and batch.void='1'
      where upper(posting.item_code)=upper(v_item) and upper(posting.warehouse_code)=upper(v_context.building_code) and nullif(btrim(coalesce(posting.batch_number,posting.ref)),'') is not null
      group by coalesce(posting.batch_number,posting.ref) having sum(case when posting.transfer_type='OUT' then -posting.qty else posting.qty end)>0
      order by min(batch.expiry_date) nulls last,min(batch.manufacturing_date) nulls last,coalesce(posting.batch_number,posting.ref)
    loop
      exit when v_remaining<=0; v_line_no:=v_line_no+1; v_alloc_qty:=least(v_remaining,v_allocation.on_hand); v_batch:=v_allocation.batch_number;
      insert into public.br_delivery_lines(created_by,br_delivery_id,line_no,allocation_group_key,harvest_age,average_live_weight,net_live_weight,delivered_date,hauler_name,plate_number,destination,live_sales_customer_name,truck_seal,
        item_id,item_code,description,batch_number,manufacturing_date,alt_qty,alt_uom,base_qty,base_uom,from_warehouse_id,from_warehouse_code,from_warehouse_name,void)
        values(v_actor,v_document_id,v_line_no,gen_random_uuid()::text,(v_row->>'harvestAge')::integer,nullif(v_row->>'averageLiveWeight','')::numeric,
          case when v_qty>0 then nullif(v_row->>'netLiveWeight','')::numeric*v_alloc_qty/v_qty else null end,v_date,nullif(v_row->>'haulerName',''),nullif(v_row->>'plateNumber',''),nullif(v_row->>'destination',''),nullif(v_row->>'customer',''),nullif(v_row->>'truckSeal','')::numeric,
          v_good_doc.item_id,v_item,v_good_doc.item_name,v_batch,coalesce(v_allocation.manufacturing_date,v_date),v_alloc_qty,'EA',v_alloc_qty,'EA',v_context.building_id,v_context.building_code,v_context.building_name,'1') returning id into v_line_id;
      insert into public.inventory_postings(source_doc_type,source_docentry,item_code,warehouse_code,bin_code,qty,created_by,ref_type,ref,batch_number,transfer_type,ref_type2,ref2)
        values('BR_DELIVERY',v_document_id,v_item,v_context.building_code,'MAIN SUB BIN',v_alloc_qty,v_actor,'batch_code',v_batch,v_batch,'OUT','BROILER_DTW',v_context.cycle_key);
      v_remaining:=v_remaining-v_alloc_qty;
    end loop;
    if v_remaining>0 then raise exception 'Harvest row % could not allocate % of % to an available batch.',v_index,v_remaining,v_item; end if;
    if not v_legacy then update public.br_delivery set notification_revision=notification_revision+1,updated_by=v_actor where id=v_document_id; end if;
    insert into public.broiler_dtw_import_rows(job_id,stage,row_no,farm_id,building_whse_id,farm_cycle_id,entity_id,raw_data)
      values(p_request_id,'Harvest Delivery',v_index,v_context.farm_id,v_context.building_id,v_context.cycle_id,v_document_id,v_row); v_harvest_count:=v_harvest_count+1;
  end loop;

  -- Stage 4: Clean Up closes the building and closes Cycle Master when all buildings are complete.
  v_index:=0;
  for v_row in select value from jsonb_array_elements(p_payload->'cleanup') loop
    v_index:=v_index+1; select * into v_context from private.broiler_dtw_resolve_context(p_request_id,v_row); v_date:=coalesce(nullif(v_row->>'cleanupDate','')::date,current_date);
    if nullif(v_row->>'cleanupDate','') is null then raise exception 'Clean Up row % requires Clean Up Date.',v_index; end if;
    v_doc_no:=format('DTW-BRCU-%s-%s-%s',to_char(v_date,'YY'),left(replace(p_request_id::text,'-',''),6),lpad(v_index::text,4,'0'));
    if exists(select 1 from public.br_cleanup where gi_no=v_doc_no) then raise exception 'Clean Up document % already exists.',v_doc_no; end if;
    insert into public.br_cleanup(created_by,created_at,gi_no,issue_date,farm_id,farm_cycle_id,farm_code,farm_name,from_warehouse_id,from_warehouse_code,from_warehouse_name,triggered_by,status,remarks)
      values(v_actor,v_date,v_doc_no,v_date,v_context.farm_id,v_context.cycle_id,v_context.farm_code,v_context.farm_name,v_context.building_id,v_context.building_code,v_context.building_name,'BR-CU','Posted',nullif(v_row->>'remarks','')) returning id into v_document_id;
    select * into v_good_doc from private.broiler_dtw_good_doc_item(v_context.farm_id); v_item:=v_good_doc.item_code;
    perform pg_advisory_xact_lock(hashtextextended('inventory:'||upper(v_item)||':'||upper(v_context.building_code),0));
    select greatest(coalesce(sum(case when transfer_type='OUT' then -qty else qty end),0),0) into v_qty from public.inventory_postings where upper(item_code)=upper(v_item) and upper(warehouse_code)=upper(v_context.building_code);
    v_line_no:=0;
    for v_allocation in
      select coalesce(posting.batch_number,posting.ref) batch_number,sum(case when posting.transfer_type='OUT' then -posting.qty else posting.qty end) on_hand,
        min(batch.manufacturing_date) manufacturing_date
      from public.inventory_postings posting left join public.item_batches batch on upper(batch.item_code)=upper(posting.item_code) and upper(batch.batch_number)=upper(coalesce(posting.batch_number,posting.ref)) and batch.void='1'
      where upper(posting.item_code)=upper(v_item) and upper(posting.warehouse_code)=upper(v_context.building_code) and nullif(btrim(coalesce(posting.batch_number,posting.ref)),'') is not null
      group by coalesce(posting.batch_number,posting.ref) having sum(case when posting.transfer_type='OUT' then -posting.qty else posting.qty end)>0
      order by min(batch.expiry_date) nulls last,min(batch.manufacturing_date) nulls last,coalesce(posting.batch_number,posting.ref)
    loop
      v_line_no:=v_line_no+1; v_batch:=v_allocation.batch_number; v_alloc_qty:=v_allocation.on_hand;
      insert into public.br_cleanup_lines(created_by,br_cleanup_id,line_no,item_id,item_code,description,remarks,batch_number,manufacturing_date,alt_qty,alt_uom,base_qty,base_uom,batch_total_qty,variance_qty,from_warehouse_id,from_warehouse_code,from_warehouse_name,void)
        values(v_actor,v_document_id,v_line_no,v_good_doc.item_id,v_item,v_good_doc.item_name,nullif(v_row->>'remarks',''),v_batch,coalesce(v_allocation.manufacturing_date,v_date),v_alloc_qty,'EA',v_alloc_qty,'EA',v_alloc_qty,0,
          v_context.building_id,v_context.building_code,v_context.building_name,'1') returning id into v_line_id;
      insert into public.inventory_postings(source_doc_type,source_docentry,item_code,warehouse_code,bin_code,qty,created_by,ref_type,ref,batch_number,transfer_type,ref_type2,ref2)
        values('BR_CLEANUP',v_document_id,v_item,v_context.building_code,'MAIN SUB BIN',v_alloc_qty,v_actor,'batch_code',v_batch,v_batch,'OUT','BROILER_DTW',v_context.cycle_key);
    end loop;
    if v_qty=0 then v_warnings:=v_warnings||jsonb_build_array(format('Clean Up row %s found no remaining Good DOC inventory.',v_index)); end if;
    update public.flock_card set status='Closed',updated_by=v_actor,updated_at=now(),extra=coalesce(extra,'{}')||jsonb_build_object('closed_by_doc_type','BR_CLEANUP','closed_by_docentry',v_document_id,'closed_by_doc_no',v_doc_no,'dtwJobId',p_request_id) where id=v_context.flock_card_id;
    if not exists(select 1 from public.flock_card card where card.farm_cycle_id=v_context.cycle_id and card.void='1' and card.status='Saved') then
      update public.doc_farm_cycles set status='Closed',closed_at=v_date,closed_by=v_actor,updated_at=now(),updated_by=v_actor where id=v_context.cycle_id;
    end if;
    if not v_legacy then update public.br_cleanup set notification_revision=notification_revision+1,updated_by=v_actor where id=v_document_id; end if;
    insert into public.broiler_dtw_import_rows(job_id,stage,row_no,farm_id,building_whse_id,farm_cycle_id,entity_id,raw_data,warnings)
      values(p_request_id,'Clean Up',v_index,v_context.farm_id,v_context.building_id,v_context.cycle_id,v_document_id,v_row,case when v_qty=0 then jsonb_build_array('No inventory movement: no remaining Good DOC inventory.') else '[]' end);
    v_cleanup_count:=v_cleanup_count+1;
  end loop;

  select count(distinct farm_cycle_id) into v_cycle_count from public.broiler_dtw_import_rows where job_id=p_request_id;
  v_result:=jsonb_build_object('jobId',p_request_id,'status','Completed','cycleCount',v_cycle_count,'placementCount',v_placement_count,'growingCount',v_growing_count,'harvestCount',v_harvest_count,'cleanupCount',v_cleanup_count,'warnings',v_warnings);
  update public.broiler_dtw_import_jobs set cycle_count=v_cycle_count,placement_count=v_placement_count,growing_count=v_growing_count,harvest_count=v_harvest_count,cleanup_count=v_cleanup_count,warnings=v_warnings,result=v_result where id=p_request_id;
  return v_result;
end;
$$;

revoke all on function private.import_broiler_dtw_workbook(uuid,jsonb) from public, anon;
grant execute on function private.import_broiler_dtw_workbook(uuid,jsonb) to authenticated;

create or replace function public.import_broiler_dtw_workbook(p_request_id uuid,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = public, private as $$
begin
  if auth.uid() is null then raise exception 'An authenticated user is required to import a workbook.' using errcode='42501'; end if;
  return private.import_broiler_dtw_workbook(p_request_id,p_payload);
end;
$$;
revoke all on function public.import_broiler_dtw_workbook(uuid,jsonb) from public, anon;
grant execute on function public.import_broiler_dtw_workbook(uuid,jsonb) to authenticated;

commit;

begin;
set local lock_timeout = '15s';

-- Legacy DTW may preserve historical mortality/thinning quantities for which
-- no reconstructable batch inventory exists. Patch only the deferred balance
-- assertion; the normal posting trigger and every non-Legacy transaction stay
-- enforced.
do $patch_mort_thin$
declare v_definition text;
begin
  if to_regprocedure('public.assert_brd_fc_mort_thin_inventory_balance(bigint)') is not null then
    select pg_get_functiondef('public.assert_brd_fc_mort_thin_inventory_balance(bigint)'::regprocedure) into v_definition;
    if position('broiler_dtw_legacy_allow_mort_thin_imbalance' in v_definition)=0 then
      v_definition:=regexp_replace(
        v_definition,
        '([[:space:]]begin[[:space:]])',
        E'\\1  if current_setting(''app.broiler_dtw_legacy_allow_mort_thin_imbalance'', true) = ''on'' then return; end if;\n',
        'i'
      );
      if position('broiler_dtw_legacy_allow_mort_thin_imbalance' in v_definition)=0 then
        raise exception 'Legacy DTW mortality/thinning compatibility could not be installed because assert_brd_fc_mort_thin_inventory_balance(bigint) has an unsupported function shape.';
      end if;
      execute v_definition;
    end if;
  end if;
end;
$patch_mort_thin$;

-- Historical imports must not notify users. Patch the centralized receiving
-- trigger only when that optional integration is installed.
do $patch$
declare v_definition text;
begin
  if to_regprocedure('public.capture_receiving_flow_event()') is not null then
    select pg_get_functiondef('public.capture_receiving_flow_event()'::regprocedure) into v_definition;
    if position('broiler_dtw_suppress_notifications' in v_definition)=0 then
      v_definition:=regexp_replace(
        v_definition,
        '([[:space:]]begin[[:space:]])',
        E'\\1  if current_setting(''app.broiler_dtw_suppress_notifications'', true) = ''on'' then return null; end if;\n',
        'i'
      );
      if position('broiler_dtw_suppress_notifications' in v_definition)=0 then
        raise exception 'Receiving notification suppression could not be installed because capture_receiving_flow_event() has an unsupported function shape.';
      end if;
      execute v_definition;
    end if;
  end if;
end;
$patch$;

notify pgrst, 'reload schema';
commit;
