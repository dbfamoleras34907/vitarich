-- Deploy after the current Broiler Cycle Master, DOC Placement, Growing,
-- Harvest & Delivery, Clean Up, and centralized notification migrations.
-- In particular, apply app/sql/new/alter_growing_harvest_age.sql and then
-- app/sql/new/alter_br_delivery_lines_add_average_live_weight.sql and
-- app/sql/updated/brd_fc_mortality_only_inventory.sql first.
begin;
set local lock_timeout = '60s';

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
  status text not null default 'Staging' check (status in ('Staging', 'Ready', 'Processing', 'Completed', 'Failed', 'Cancelled')),
  cycle_count integer not null default 0,
  placement_count integer not null default 0,
  growing_count integer not null default 0,
  harvest_count integer not null default 0,
  cleanup_count integer not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.broiler_dtw_import_jobs
  drop constraint if exists broiler_dtw_import_jobs_status_check;
alter table public.broiler_dtw_import_jobs
  add constraint broiler_dtw_import_jobs_status_check
  check (status in ('Staging', 'Ready', 'Processing', 'Completed', 'Failed', 'Cancelled'));
alter table public.broiler_dtw_import_jobs alter column status set default 'Staging';
create index if not exists broiler_dtw_import_jobs_actor_payload_idx
on public.broiler_dtw_import_jobs(actor_auth_id,payload_hash,created_at desc);

create table if not exists private.broiler_dtw_staged_rows (
  job_id uuid not null references public.broiler_dtw_import_jobs(id) on delete cascade,
  stage text not null check (stage in ('placement', 'growing', 'harvest', 'cleanup')),
  row_no integer not null check (row_no > 0),
  raw_data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (job_id, stage, row_no)
);

revoke all on private.broiler_dtw_staged_rows from public, anon, authenticated;

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
  cycle_created boolean not null default false,
  created_at timestamptz not null default now(),
  unique(job_id, import_cycle_key)
);

alter table public.broiler_dtw_cycle_links add column if not exists placement_date date;
alter table public.broiler_dtw_cycle_links add column if not exists cycle_created boolean not null default false;
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

create index if not exists goods_receipt_doc_flock_card_active_idx
on public.goods_receipt_doc(flock_card_id,goods_reciept_id) where void='1';

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

-- The atomic finalizer must finish inside the Data API request ceiling. These
-- indexes match its normalized inventory and batch lookups instead of forcing
-- a full ledger scan for every imported row.
create index if not exists inventory_postings_dtw_stock_lookup_idx
on public.inventory_postings (
  upper(btrim(item_code)),
  upper(btrim(warehouse_code)),
  upper(btrim(coalesce(batch_number,ref)))
) include (qty,transfer_type);

create index if not exists inventory_postings_dtw_feed_history_idx
on public.inventory_postings (upper(btrim(item_code))) include (qty)
where source_doc_type='BRD_FC_FEED_USAGE' and transfer_type='OUT';

create index if not exists item_batches_dtw_lookup_idx
on public.item_batches (upper(btrim(item_code)),upper(btrim(batch_number)))
include (manufacturing_date,expiry_date) where void='1';

-- One reusable, cycle-scoped view of the Good DOC batches that originated
-- from a specific Placement card. Harvest and Clean Up must never consume an
-- unrelated cycle merely because it uses the same item and building.
create or replace function private.broiler_dtw_cycle_doc_inventory(p_flock_card_id bigint)
returns table(
  line_no integer,item_code text,item_name text,batch_number text,
  warehouse_id bigint,warehouse_code text,warehouse_name text,
  on_hand numeric,manufacturing_date date,expiry_date date
) language sql stable security definer set search_path = public, pg_temp as $$
  with cycle_batches as (
    select min(origin.line_no)::integer line_no,btrim(origin.item_code) item_code,
      min(origin.item_name) item_name,btrim(origin.batch_no) batch_number,
      card.building_whse_id warehouse_id,btrim(coalesce(card.building_code,warehouse.whse_code)) warehouse_code,
      min(coalesce(card.building_name,warehouse.whse_name)) warehouse_name
    from public.flock_card card
    join public.flock_card_origin origin on origin.fc_id=card.id and origin.void='1'
    left join public.i_warehouse warehouse on warehouse.id=card.building_whse_id
    where card.id=p_flock_card_id and card.void='1'
      and nullif(btrim(origin.item_code),'') is not null
      and nullif(btrim(origin.batch_no),'') is not null
      and nullif(btrim(coalesce(card.building_code,warehouse.whse_code)),'') is not null
    group by origin.item_code,origin.batch_no,card.building_whse_id,coalesce(card.building_code,warehouse.whse_code)
  )
  select cycle_batch.line_no,cycle_batch.item_code,cycle_batch.item_name,cycle_batch.batch_number,
    cycle_batch.warehouse_id,cycle_batch.warehouse_code,cycle_batch.warehouse_name,
    coalesce(balance.on_hand,0)::numeric,
    dates.manufacturing_date,dates.expiry_date
  from cycle_batches cycle_batch
  left join lateral (
    select sum(case when posting.transfer_type='OUT' then -posting.qty else posting.qty end) on_hand
    from public.inventory_postings posting
    where upper(btrim(posting.item_code))=upper(cycle_batch.item_code)
      and upper(btrim(posting.warehouse_code))=upper(cycle_batch.warehouse_code)
      and upper(btrim(coalesce(posting.batch_number,posting.ref)))=upper(cycle_batch.batch_number)
  ) balance on true
  left join lateral (
    select min(batch.manufacturing_date) manufacturing_date,min(batch.expiry_date) expiry_date
    from public.item_batches batch
    where batch.void='1'
      and upper(btrim(batch.item_code))=upper(cycle_batch.item_code)
      and upper(btrim(batch.batch_number))=upper(cycle_batch.batch_number)
  ) dates on true;
$$;
revoke all on function private.broiler_dtw_cycle_doc_inventory(bigint) from public, anon, authenticated;

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
declare v_farm public.farms%rowtype; v_building public.i_warehouse%rowtype; v_cycle public.doc_farm_cycles%rowtype; v_card public.flock_card%rowtype; v_placement_batch text;
begin
  select * into v_farm from public.farms f where upper(btrim(f.code))=upper(btrim(p_row->>'farmCode')) and coalesce(btrim(f.void::text),'1')='1';
  if not found or upper(btrim(coalesce(v_farm.farm_type,''))) not in ('BR','BROILER') then raise exception 'Farm % was not found, inactive, or is not Broiler.',coalesce(p_row->>'farmCode','<blank>'); end if;
  perform private.broiler_dtw_assert_access(v_farm.id);
  select * into v_building from public.i_warehouse w where upper(btrim(w.whse_code))=upper(btrim(p_row->>'buildingCode'))
    and coalesce(w.is_active,true) and (w.farm_id::text=v_farm.id::text or upper(btrim(coalesce(w.farm_code,'')))=upper(btrim(v_farm.code))) limit 1;
  if not found then raise exception 'Building % does not belong to farm %.',coalesce(p_row->>'buildingCode','<blank>'),v_farm.code; end if;
  v_placement_batch:=coalesce(nullif(btrim(p_row->>'placementBatch'),''),nullif(btrim(p_row->>'existingCycleKey'),''));
  if v_placement_batch is not null then
    select * into v_cycle from public.doc_farm_cycles c where c.farm_id=v_farm.id and upper(btrim(c.cycle_key))=upper(v_placement_batch);
    -- An absent Cycle Master row is a skippable source-data gap. Return no
    -- context so every DTW stage can record the skip without business writes.
    if not found then return; end if;
    select * into v_card from public.flock_card c where c.farm_cycle_id=v_cycle.id and c.farm_id=v_farm.id and c.building_whse_id=v_building.id and c.void='1' order by c.id desc limit 1;
  else
    if nullif(btrim(p_row->>'importCycleKey'),'') is not null then
      select c.* into v_cycle from public.broiler_dtw_cycle_links link join public.doc_farm_cycles c on c.id=link.farm_cycle_id
        where link.job_id=p_job_id and upper(link.import_cycle_key)=upper(btrim(p_row->>'importCycleKey'));
      select card.* into v_card from public.broiler_dtw_cycle_links link join public.flock_card card on card.id=link.flock_card_id
        where link.job_id=p_job_id and upper(link.import_cycle_key)=upper(btrim(p_row->>'importCycleKey'));
    elsif nullif(p_row->>'placementDate','') is not null then
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
    else
      raise exception 'Placement Batch is required to resolve the Broiler cycle.';
    end if;
  end if;
  if v_cycle.id is null or v_card.id is null then raise exception 'The row cannot be linked to a DOC Placement cycle.'; end if;
  if v_cycle.farm_id<>v_farm.id then raise exception 'The selected cycle belongs to another farm.'; end if;
  if v_card.building_whse_id<>v_building.id then raise exception 'The selected cycle belongs to another building.'; end if;
  return query select v_farm.id,v_farm.code,v_farm.name,v_building.id,v_building.whse_code,v_building.whse_name,v_cycle.id,v_cycle.cycle_key,v_card.id;
end;
$$;
revoke all on function private.broiler_dtw_resolve_context(uuid,jsonb) from public, anon, authenticated;

create or replace function private.stage_broiler_dtw_workbook(p_request_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  v_actor uuid:=auth.uid();
  v_mode text:=lower(coalesce(p_payload->>'mode','standard'));
  v_hash text:=nullif(p_payload->>'importHash','');
  v_stage text:=lower(coalesce(p_payload->>'stage',''));
  v_rows jsonb:=coalesce(p_payload->'rows','[]'::jsonb);
  v_expected jsonb:=coalesce(p_payload->'expectedCounts','{}'::jsonb);
  v_job public.broiler_dtw_import_jobs%rowtype;
  v_row jsonb;
  v_row_no integer;
  v_counts jsonb;
  v_ready boolean;
begin
  if v_actor is null then raise exception 'An authenticated user is required to stage a workbook.' using errcode='42501'; end if;
  if p_request_id is null or v_hash is null then raise exception 'The DTW request identity and content hash are required.'; end if;
  if v_mode not in ('standard','legacy') then raise exception 'DTW mode must be standard or legacy.'; end if;
  if v_stage not in ('placement','growing','harvest','cleanup') then raise exception 'The DTW staging module is invalid.'; end if;
  if jsonb_typeof(v_rows) is distinct from 'array' then raise exception 'The DTW staging rows must be an array.'; end if;
  if jsonb_typeof(v_expected) is distinct from 'object'
    or coalesce((v_expected->>'placement')::integer,-1)<0
    or coalesce((v_expected->>'growing')::integer,-1)<0
    or coalesce((v_expected->>'harvest')::integer,-1)<0
    or coalesce((v_expected->>'cleanup')::integer,-1)<0 then
    raise exception 'The DTW expected row counts are invalid.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into v_job from public.broiler_dtw_import_jobs where id=p_request_id;
  if found then
    if v_job.actor_auth_id<>v_actor or v_job.payload_hash<>v_hash then
      raise exception 'Import request ownership or content mismatch.' using errcode='42501';
    end if;
    if v_job.status='Completed' then return v_job.result; end if;
    if v_job.status='Cancelled' then raise exception 'This DTW import was cancelled and cannot be resumed.'; end if;
    if exists(select 1 from public.broiler_dtw_import_rows imported where imported.job_id=p_request_id) then
      raise exception 'This is a legacy partial DTW import. Cancel it before starting the workbook again.';
    end if;
    if coalesce(v_job.result->'expectedCounts','null'::jsonb) is distinct from v_expected then
      raise exception 'The staged DTW workbook row counts do not match the original request.';
    end if;
  else
    insert into public.broiler_dtw_import_jobs(id,actor_auth_id,mode,file_name,payload_hash,status,warnings,result)
    values(
      p_request_id,v_actor,v_mode,coalesce(nullif(btrim(p_payload->>'fileName'),''),'broiler-dtw.xlsx'),v_hash,'Staging',
      coalesce(p_payload->'warnings','[]'::jsonb),jsonb_build_object('expectedCounts',v_expected)
    ) returning * into v_job;
  end if;

  for v_row in select value from jsonb_array_elements(v_rows) loop
    v_row_no:=nullif(v_row->>'_dtwRowNo','')::integer;
    if v_row_no is null or v_row_no<1 then raise exception 'Every staged DTW row requires a positive Excel row number.'; end if;
    if exists(
      select 1 from private.broiler_dtw_staged_rows staged
      where staged.job_id=p_request_id and staged.stage=v_stage and staged.row_no=v_row_no and staged.raw_data<>v_row
    ) then
      raise exception 'Staged % row % does not match the original workbook content.',v_stage,v_row_no;
    end if;
    insert into private.broiler_dtw_staged_rows(job_id,stage,row_no,raw_data)
    values(p_request_id,v_stage,v_row_no,v_row)
    on conflict (job_id,stage,row_no) do nothing;
  end loop;

  select jsonb_build_object(
    'placement',count(*) filter(where stage='placement'),
    'growing',count(*) filter(where stage='growing'),
    'harvest',count(*) filter(where stage='harvest'),
    'cleanup',count(*) filter(where stage='cleanup')
  ) into v_counts
  from private.broiler_dtw_staged_rows where job_id=p_request_id;
  v_ready:=(v_counts->>'placement')::integer=(v_expected->>'placement')::integer
    and (v_counts->>'growing')::integer=(v_expected->>'growing')::integer
    and (v_counts->>'harvest')::integer=(v_expected->>'harvest')::integer
    and (v_counts->>'cleanup')::integer=(v_expected->>'cleanup')::integer;
  update public.broiler_dtw_import_jobs
  set status=case when v_ready then 'Ready' else 'Staging' end,
    result=jsonb_build_object('jobId',p_request_id,'status',case when v_ready then 'Ready' else 'Staging' end,'expectedCounts',v_expected,'stagedCounts',v_counts)
  where id=p_request_id;
  return jsonb_build_object('jobId',p_request_id,'status',case when v_ready then 'Ready' else 'Staging' end,'expectedCounts',v_expected,'stagedCounts',v_counts);
end;
$$;

revoke all on function private.stage_broiler_dtw_workbook(uuid,jsonb) from public, anon, authenticated;
grant execute on function private.stage_broiler_dtw_workbook(uuid,jsonb) to authenticated;

create or replace function private.import_broiler_dtw_workbook(p_request_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  v_actor uuid:=auth.uid(); v_mode text:=lower(coalesce(p_payload->>'mode','standard')); v_legacy boolean;
  v_chunked boolean:=coalesce((p_payload->>'chunked')::boolean,false); v_final_chunk boolean:=coalesce((p_payload->>'finalChunk')::boolean,true);
  v_hash text:=coalesce(nullif(p_payload->>'importHash',''),md5(p_payload::text)); v_existing public.broiler_dtw_import_jobs%rowtype; v_row jsonb; v_context record;
  v_farm public.farms%rowtype; v_building public.i_warehouse%rowtype; v_cycle public.doc_farm_cycles%rowtype;
  v_card_id bigint; v_receipt_id bigint; v_detail_id bigint; v_growing_id bigint; v_line_id bigint; v_document_id bigint; v_ba_id bigint;
  v_index integer:=0; v_internal_cycle bigint; v_cycle_key text; v_card_no text; v_doc_no text; v_batch text; v_item text; v_qty numeric; v_on_hand numeric; v_origin_line integer;
  v_good_doc record; v_allocation record; v_remaining numeric; v_alloc_qty numeric; v_line_no integer; v_age integer; v_mortality_total numeric; v_row_total numeric; v_cumulative_total numeric; v_feed_per_bird numeric; v_animal_qty numeric;
  v_date date; v_age_start_date date; v_calculated_age integer; v_growing_age_starts jsonb:='{}'::jsonb; v_mortality_allocations jsonb:='[]'::jsonb; v_feed_item_cache jsonb:='{}'::jsonb; v_feed_cache_key text; v_warning text; v_result jsonb; v_warnings jsonb:=coalesce(p_payload->'warnings','[]'::jsonb);
  v_cycle_created boolean:=false;
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
  if jsonb_array_length(p_payload->'placement')+jsonb_array_length(p_payload->'growing')+jsonb_array_length(p_payload->'harvest')+jsonb_array_length(p_payload->'cleanup')=0
    and not (v_chunked and v_final_chunk) then
    raise exception 'The workbook contains no import rows.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into v_existing from public.broiler_dtw_import_jobs where id=p_request_id;
  if found then
    if v_existing.actor_auth_id<>v_actor or v_existing.payload_hash<>v_hash then raise exception 'Import request ownership or content mismatch.' using errcode='42501'; end if;
    if v_existing.status='Completed' then return v_existing.result; end if;
    if v_existing.status='Cancelled' then raise exception 'This DTW import was cancelled and cannot be resumed.'; end if;
    v_warnings:=coalesce(v_existing.warnings,'[]'::jsonb)||case when jsonb_array_length(coalesce(v_existing.warnings,'[]'::jsonb))=0 then v_warnings else '[]'::jsonb end;
    update public.broiler_dtw_import_jobs set status='Processing' where id=p_request_id and status not in ('Completed','Cancelled');
  else
    insert into public.broiler_dtw_import_jobs(id,actor_auth_id,mode,file_name,payload_hash,status)
    values(p_request_id,v_actor,v_mode,coalesce(nullif(btrim(p_payload->>'fileName'),''),'broiler-dtw.xlsx'),v_hash,'Processing');
  end if;
  -- This transaction-local flag is consumed only by the shared Flock Card
  -- posting functions. Normal workflows remain strict about on-hand stock.
  perform set_config('app.broiler_dtw_allow_negative_inventory','on',true);
  -- DTW owns and validates the imported Farm + Building + Placement Batch
  -- context before writing the flock card. Let this transaction create the
  -- historical card even when the building has another open cycle; ordinary
  -- Flock Card and DOC Placement transactions remain protected.
  perform set_config('app.broiler_dtw_force_cycle_insert','on',true);
  if v_legacy then
    perform set_config('app.broiler_dtw_suppress_notifications','on',true);
    perform set_config('app.broiler_dtw_legacy_allow_mort_thin_imbalance','on',true);
  end if;

  -- Stage 1: DOC Placement creates the Cycle Master and building flock card.
  for v_row in select value from jsonb_array_elements(p_payload->'placement') loop
    v_index:=coalesce(nullif(v_row->>'_dtwRowNo','')::integer,v_index+1);
    if v_chunked and exists(select 1 from public.broiler_dtw_import_rows imported where imported.job_id=p_request_id and imported.stage='DOC Placement' and imported.row_no=v_index) then continue; end if;
    if nullif(btrim(v_row->>'placementBatch'),'') is null or nullif(v_row->>'quantityReceived','') is null then
      raise exception 'DOC Placement row % requires Placement Batch and Quantity Received.',v_index;
    end if;
    select * into v_farm from public.farms f where upper(btrim(f.code))=upper(btrim(v_row->>'farmCode')) and coalesce(btrim(f.void::text),'1')='1';
    if not found or upper(btrim(coalesce(v_farm.farm_type,''))) not in ('BR','BROILER') then raise exception 'DOC Placement row % has an invalid Broiler Farm.',v_index; end if;
    perform private.broiler_dtw_assert_access(v_farm.id);
    select * into v_building from public.i_warehouse w where upper(btrim(w.whse_code))=upper(btrim(v_row->>'buildingCode')) and coalesce(w.is_active,true)
      and (w.farm_id::text=v_farm.id::text or upper(btrim(coalesce(w.farm_code,'')))=upper(btrim(v_farm.code))) limit 1;
    if not found then raise exception 'DOC Placement row % has an invalid Building for farm %.',v_index,v_farm.code; end if;
    v_date:=coalesce(nullif(v_row->>'placementDate','')::date,current_date);
    v_cycle_created:=false;
    v_cycle_key:=btrim(v_row->>'placementBatch');
    v_qty:=greatest(
      coalesce(nullif(v_row->>'quantityReceived','')::numeric,0)
      - coalesce(nullif(v_row->>'doaCount','')::numeric,0)
      - coalesce(nullif(v_row->>'rejectCount','')::numeric,0)
      - coalesce(nullif(v_row->>'shortCount','')::numeric,0),
      0
    );
    if coalesce(nullif(v_row->>'doaCount','')::numeric,0)+coalesce(nullif(v_row->>'rejectCount','')::numeric,0)+coalesce(nullif(v_row->>'shortCount','')::numeric,0)>coalesce(nullif(v_row->>'quantityReceived','')::numeric,0) then
      raise exception 'DOC Placement row % has DOA + Reject + Short Count greater than Quantity Received.',v_index;
    end if;
    perform pg_advisory_xact_lock(73191,v_farm.id::integer);
    select * into v_cycle from public.doc_farm_cycles c where c.farm_id=v_farm.id and upper(btrim(c.cycle_key))=upper(v_cycle_key);
    if v_cycle.id is null then
      select coalesce(max(c.cycle_no),0)+1 into v_internal_cycle from public.doc_farm_cycles c where c.farm_id=v_farm.id;
      insert into public.doc_farm_cycles(farm_id,cycle_no,cycle_key,cycle_mask,status,created_by,created_at)
        values(v_farm.id,v_internal_cycle,v_cycle_key,v_cycle_key,'Past Open',v_actor,v_date) returning * into v_cycle;
      v_cycle_created:=true;
    end if;
    select * into v_context from public.flock_card c where c.farm_cycle_id=v_cycle.id and c.farm_id=v_farm.id and c.building_whse_id=v_building.id and c.void='1' order by c.id desc limit 1;
    if v_context.id is not null then
      select receipt.id into v_receipt_id
      from public.goods_receipt receipt
      join public.goods_receipt_doc detail on detail.goods_reciept_id=receipt.id and detail.void='1'
      where receipt.status='Posted' and detail.flock_card_id=v_context.id
      order by receipt.id desc limit 1;
      if found then
        v_warnings:=v_warnings||jsonb_build_array(format('DOC Placement row %s skipped because Goods Receipt %s is already Posted.',v_index,v_receipt_id));
        insert into public.broiler_dtw_cycle_links(job_id,import_cycle_key,farm_id,building_whse_id,placement_date,farm_cycle_id,flock_card_id,cycle_key,cycle_created)
          values(p_request_id,coalesce(nullif(btrim(v_row->>'importCycleKey'),''),format('__AUTO__:%s:%s:%s:%s',v_farm.id,v_building.id,upper(v_cycle_key),v_index)),v_farm.id,v_building.id,nullif(v_row->>'placementDate','')::date,v_cycle.id,v_context.id,v_cycle_key,v_cycle_created);
        insert into public.broiler_dtw_import_rows(job_id,stage,row_no,farm_id,building_whse_id,farm_cycle_id,entity_id,raw_data,warnings)
          values(p_request_id,'DOC Placement',v_index,v_farm.id,v_building.id,v_cycle.id,v_receipt_id,v_row,jsonb_build_array('Skipped: a matching DOC Placement Goods Receipt is already Posted.'));
        v_cycle_count:=v_cycle_count+1; v_placement_count:=v_placement_count+1;
        continue;
      end if;
    end if;
    if v_context.id is null and exists(select 1 from public.flock_card c where c.farm_id=v_farm.id and c.building_whse_id=v_building.id and c.void='1' and c.status='Saved') then
      v_warnings:=v_warnings||jsonb_build_array(format(
        'DOC Placement row %s imported Placement Batch %s while Building %s also has another open cycle.',
        v_index,v_cycle_key,v_building.whse_code
      ));
    end if;
    if v_context.id is null then
      v_card_no:=format('DTW-%s-%s',replace(p_request_id::text,'-',''),lpad(v_index::text,4,'0'));
      insert into public.flock_card(created_by,created_at,card_no,farm_id,farm_cycle_id,farm_code,farm_name,building_whse_id,building_src,building_key,
        building_code,building_name,start_date,cycle_no,animal_qty,status,remarks,extra,void)
      values(v_actor,v_date,v_card_no,v_farm.id,v_cycle.id,v_farm.code,v_farm.name,v_building.id,'WAREHOUSE','WAREHOUSE:'||v_building.id,
        v_building.whse_code,v_building.whse_name,v_date,v_cycle_key,v_qty,'Saved',nullif(v_row->>'remarks',''),
        jsonb_build_object('createdFrom','BROILER_DTW','dtwJobId',p_request_id,'legacy',v_legacy),'1') returning id into v_card_id;
    else
      if v_context.status<>'Saved' then raise exception 'Placement Batch % for building % is already closed.',v_cycle_key,v_building.whse_code; end if;
      v_card_id:=v_context.id;
      update public.flock_card set animal_qty=coalesce(animal_qty,0)+v_qty,updated_by=v_actor,updated_at=now() where id=v_card_id;
    end if;
    select * into v_good_doc from private.broiler_dtw_good_doc_item(v_farm.id);
    v_item:=v_good_doc.item_code;
    v_doc_no:=format('DTW-DOC-%s-%s',to_char(v_date,'YY'),lpad(v_index::text,6,'0'))||'-'||left(replace(p_request_id::text,'-',''),6);
    insert into public.goods_receipt(created_by,created_at,gr_no,dr_reference,vendor,receive_date,fms_type,farm_id,farm_code,farm_name,default_warehouse_id,status,remarks)
      values(v_actor,v_date,v_doc_no,'LEGACY','LEGACY',v_date,'broiler',v_farm.id,v_farm.code,v_farm.name,v_building.id,'Posted',nullif(v_row->>'remarks','')) returning id into v_receipt_id;
    v_batch:=public.receiving_new_batch('broiler',v_receipt_id,'DTW:'||v_card_id,v_item,v_date,null,null);
    select coalesce(max(origin.line_no),0)+1 into v_origin_line from public.flock_card_origin origin where origin.fc_id=v_card_id;
    insert into public.flock_card_origin(created_by,fc_id,line_no,item_id,item_code,item_name,batch_no,whse_id,whse_code,whse_name,animal_qty,onhand_snapshot,mfg_date,extra,void)
      values(v_actor,v_card_id,v_origin_line,v_good_doc.item_id,v_item,v_good_doc.item_name,v_batch,v_building.id,v_building.whse_code,v_building.whse_name,v_qty,v_qty,v_date,
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
    insert into public.broiler_dtw_cycle_links(job_id,import_cycle_key,farm_id,building_whse_id,placement_date,farm_cycle_id,flock_card_id,cycle_key,cycle_created)
      values(p_request_id,coalesce(nullif(btrim(v_row->>'importCycleKey'),''),format('__AUTO__:%s:%s:%s:%s',v_farm.id,v_building.id,upper(v_cycle_key),v_index)),v_farm.id,v_building.id,nullif(v_row->>'placementDate','')::date,v_cycle.id,v_card_id,v_cycle_key,v_cycle_created);
    insert into public.broiler_dtw_import_rows(job_id,stage,row_no,farm_id,building_whse_id,farm_cycle_id,entity_id,raw_data)
      values(p_request_id,'DOC Placement',v_index,v_farm.id,v_building.id,v_cycle.id,v_receipt_id,v_row);
    v_cycle_count:=v_cycle_count+1; v_placement_count:=v_placement_count+1;
  end loop;

  -- Stage 2: Growing. Later Growing rows remain allowed after Harvest.
  -- Age groups are exact Farm + Building + Placement Batch + Placement Date
  -- groups. A blank optional Placement Date falls back to that exact group's
  -- first Entry Date; it never shares a baseline with another building/date.
  select coalesce(jsonb_object_agg(age_group.group_key,age_group.start_date), '{}'::jsonb)
  into v_growing_age_starts
  from (
    select
      upper(btrim(source.row->>'farmCode'))||chr(31)
        ||upper(btrim(source.row->>'buildingCode'))||chr(31)
        ||upper(btrim(source.row->>'placementBatch'))||chr(31)
        ||coalesce(source.row->>'placementDate','') group_key,
      coalesce(min(nullif(source.row->>'placementDate','')::date),min(nullif(source.row->>'entryDate','')::date)) start_date
    from jsonb_array_elements(p_payload->'growing') source(row)
    group by upper(btrim(source.row->>'farmCode')),upper(btrim(source.row->>'buildingCode')),
      upper(btrim(source.row->>'placementBatch')),coalesce(source.row->>'placementDate','')
  ) age_group
  where age_group.start_date is not null;

  v_index:=0;
  for v_row in select value from jsonb_array_elements(p_payload->'growing') loop
    v_index:=coalesce(nullif(v_row->>'_dtwRowNo','')::integer,v_index+1);
    if v_chunked and exists(select 1 from public.broiler_dtw_import_rows imported where imported.job_id=p_request_id and imported.stage='Growing' and imported.row_no=v_index) then continue; end if;
    select * into v_context from private.broiler_dtw_resolve_context(p_request_id,v_row);
    if not found then
      v_warnings:=v_warnings||jsonb_build_array(format(
        'Skipped: Growing row %s because Placement Batch %s was not found in Cycle Master for farm %s.',
        v_index,coalesce(nullif(btrim(v_row->>'placementBatch'),''),nullif(btrim(v_row->>'existingCycleKey'),''),'<blank>'),coalesce(v_row->>'farmCode','<blank>')
      ));
      v_growing_count:=v_growing_count+1;
      continue;
    end if;
    v_date:=coalesce(nullif(v_row->>'entryDate','')::date,current_date);
    if nullif(v_row->>'entryDate','') is null or nullif(v_row->>'mortalityAm','') is null then
      raise exception 'Growing row % requires Entry Date and Mortality AM.',v_index;
    end if;
    v_age_start_date:=nullif(v_growing_age_starts->>(
      upper(btrim(v_row->>'farmCode'))||chr(31)
        ||upper(btrim(v_row->>'buildingCode'))||chr(31)
        ||upper(btrim(v_row->>'placementBatch'))||chr(31)
        ||coalesce(v_row->>'placementDate','')
    ),'')::date;
    v_calculated_age:=(v_date-v_age_start_date)+1;
    if v_calculated_age is null or v_calculated_age<1 then
      raise exception 'Growing row % calculated Age % below the allowed minimum of 1. Check Placement Date for Placement Batch %.',v_index,coalesce(v_calculated_age::text,'blank'),v_context.cycle_key;
    end if;
    v_age:=least(v_calculated_age,50);
    select id into v_growing_id from public.brd_fc where card_no=(select card_no from public.flock_card where id=v_context.flock_card_id) and void='1' order by id desc limit 1;
    select line.id into v_line_id
    from public.brd_fc_line line
    join public.brd_fc header on header.id=line.fc_id
    where header.id=v_growing_id and header.status='Posted' and header.void='1' and line.age=v_age and line.void='1'
    order by line.id desc limit 1;
    if found then
      v_warnings:=v_warnings||jsonb_build_array(format('Growing row %s skipped because Age %s is already Posted for cycle %s.',v_index,v_age,v_context.cycle_key));
      insert into public.broiler_dtw_import_rows(job_id,stage,row_no,farm_id,building_whse_id,farm_cycle_id,entity_id,raw_data,warnings)
        values(p_request_id,'Growing',v_index,v_context.farm_id,v_context.building_id,v_context.cycle_id,v_line_id,v_row,jsonb_build_array('Skipped: a matching Growing age is already Posted.'));
      v_growing_count:=v_growing_count+1;
      continue;
    end if;
    if exists(select 1 from public.flock_card card where card.id=v_context.flock_card_id and card.status<>'Saved') then
      v_warning:=format('DTW allowed Growing rows for already-closed Placement Batch %s.',v_context.cycle_key);
      if not (v_warnings ? v_warning) then v_warnings:=v_warnings||jsonb_build_array(v_warning); end if;
    end if;
    if v_growing_id is null then
      insert into public.brd_fc(created_by,fc_no,card_no,fc_date,farm_id,farm_code,farm_name,building_whse_id,building_src,building_key,building_code,building_name,building_status,animal_qty,status,remarks,void)
      select v_actor,format('DTW-FC-%s-%s',left(replace(p_request_id::text,'-',''),8),v_context.flock_card_id),card.card_no,coalesce(nullif(v_row->>'entryDate','')::date,card.start_date),
        v_context.farm_id,v_context.farm_code,v_context.farm_name,v_context.building_id,'WAREHOUSE','WAREHOUSE:'||v_context.building_id,v_context.building_code,v_context.building_name,'Saved',card.animal_qty,'Posted','Imported by Data Transfer Workbench','1'
      from public.flock_card card where card.id=v_context.flock_card_id returning id into v_growing_id;
    end if;
    if exists(select 1 from public.brd_fc_line line where line.fc_id=v_growing_id and line.age=v_age and line.void='1') then
      raise exception 'Growing row % duplicates Age % in cycle %.',v_index,v_age,v_context.cycle_key;
    end if;
    v_mortality_total:=coalesce(nullif(v_row->>'mortalityAm','')::numeric,0)+coalesce(nullif(v_row->>'mortalityPm','')::numeric,0);
    v_row_total:=v_mortality_total+coalesce(nullif(v_row->>'thinningAm','')::numeric,0)+coalesce(nullif(v_row->>'thinningPm','')::numeric,0);
    if v_mortality_total<>trunc(v_mortality_total) then raise exception 'Growing row % mortality must be a whole-bird quantity for automatic DOC inventory deduction.',v_index; end if;
    v_mortality_allocations:='[]'::jsonb;
    v_remaining:=v_mortality_total;
    if v_remaining>0 then
      for v_allocation in
        select inventory.line_no,inventory.item_code,inventory.item_name,
          inventory.batch_number batch_no,inventory.on_hand onhand_snapshot
        from private.broiler_dtw_cycle_doc_inventory(v_context.flock_card_id) inventory
        where inventory.on_hand>0
        order by inventory.expiry_date nulls last,inventory.manufacturing_date nulls last,inventory.line_no,inventory.batch_number
      loop
        exit when v_remaining<=0;
        perform pg_advisory_xact_lock(hashtextextended('inventory:'||upper(v_allocation.item_code)||':'||upper(v_context.building_code),0));
        select coalesce(sum(case when posting.transfer_type='OUT' then -posting.qty else posting.qty end),0)
        into v_on_hand
        from public.inventory_postings posting
        where upper(btrim(posting.item_code))=upper(btrim(v_allocation.item_code))
          and upper(btrim(posting.warehouse_code))=upper(btrim(v_context.building_code))
          and upper(btrim(coalesce(posting.batch_number,posting.ref)))=upper(btrim(v_allocation.batch_no));
        v_alloc_qty:=least(v_remaining,greatest(v_on_hand,0));
        if v_alloc_qty<=0 then continue; end if;
        v_mortality_allocations:=v_mortality_allocations||jsonb_build_array(jsonb_build_object(
          'lineNo',jsonb_array_length(v_mortality_allocations)+1,
          'itemCode',v_allocation.item_code,
          'itemName',v_allocation.item_name,
          'batchNumber',v_allocation.batch_no,
          'warehouseCode',v_context.building_code,
          'allocatedQty',v_alloc_qty,
          'onHandSnapshot',v_on_hand,
          'source','FIFO'
        ));
        v_remaining:=v_remaining-v_alloc_qty;
      end loop;
      if v_remaining>0 then
        select inventory.line_no,inventory.item_code,inventory.item_name,
          inventory.batch_number batch_no,inventory.on_hand onhand_snapshot
        into v_allocation
        from private.broiler_dtw_cycle_doc_inventory(v_context.flock_card_id) inventory
        order by inventory.expiry_date nulls last,inventory.manufacturing_date nulls last,inventory.line_no,inventory.batch_number
        limit 1;
        if not found then
          raise exception 'Growing row % cannot find a cycle DOC Placement batch for % mortality birds.',v_index,v_remaining;
        end if;
        perform pg_advisory_xact_lock(hashtextextended('inventory:'||upper(v_allocation.item_code)||':'||upper(v_context.building_code),0));
        select coalesce(sum(case when posting.transfer_type='OUT' then -posting.qty else posting.qty end),0)
        into v_on_hand
        from public.inventory_postings posting
        where upper(btrim(posting.item_code))=upper(btrim(v_allocation.item_code))
          and upper(btrim(posting.warehouse_code))=upper(btrim(v_context.building_code))
          and upper(btrim(coalesce(posting.batch_number,posting.ref)))=upper(btrim(v_allocation.batch_no));
        v_mortality_allocations:=v_mortality_allocations||jsonb_build_array(jsonb_build_object(
          'lineNo',jsonb_array_length(v_mortality_allocations)+1,
          'itemCode',v_allocation.item_code,
          'itemName',v_allocation.item_name,
          'batchNumber',v_allocation.batch_no,
          'warehouseCode',v_context.building_code,
          'allocatedQty',v_remaining,
          'onHandSnapshot',v_on_hand,
          'source','DTW_NEGATIVE'
        ));
        v_warnings:=v_warnings||jsonb_build_array(format('Growing row %s used %s negative DOC inventory from batch %s.',v_index,v_remaining,v_allocation.batch_no));
        v_remaining:=0;
      end if;
    end if;
    select coalesce(sum(line.row_total),0)+v_row_total into v_cumulative_total from public.brd_fc_line line where line.fc_id=v_growing_id and line.void='1';
    select animal_qty into v_animal_qty from public.flock_card where id=v_context.flock_card_id;
    v_feed_per_bird:=case when coalesce(v_animal_qty,0)-v_cumulative_total>0 then coalesce(nullif(v_row->>'feedKg','')::numeric,0)*1000/(v_animal_qty-v_cumulative_total) else 0 end;
    insert into public.brd_fc_line(created_by,fc_id,age,mort_am,mort_pm,mort_total,thin_am,thin_pm,row_total,cum_total,mortality_remarks,feed_kg,feed_bird,feed_batch_text,water_l,water_bird,
      body_wt,temp_min,temp_max,hum_min,hum_max,nh3_max,extra,void)
    values(v_actor,v_growing_id,v_age,nullif(v_row->>'mortalityAm','')::numeric,nullif(v_row->>'mortalityPm','')::numeric,
      v_mortality_total,nullif(v_row->>'thinningAm','')::numeric,nullif(v_row->>'thinningPm','')::numeric,v_row_total,v_cumulative_total,
      case when v_mortality_total>0 then coalesce(nullif(btrim(v_row->>'remarks'),''),'Imported by Data Transfer Workbench') else null end,
      nullif(v_row->>'feedKg','')::numeric,v_feed_per_bird,null,nullif(v_row->>'waterLiters','')::numeric,nullif(v_row->>'waterPerBird','')::numeric,
      nullif(v_row->>'bodyWeight','')::numeric,nullif(v_row->>'tempMin','')::numeric,nullif(v_row->>'tempMax','')::numeric,nullif(v_row->>'humidityMin','')::numeric,nullif(v_row->>'humidityMax','')::numeric,
      nullif(v_row->>'nh3Max','')::numeric,jsonb_build_object(
        'dtwJobId',p_request_id,'entryDate',v_row->>'entryDate','legacy',v_legacy,'remarks',v_row->>'remarks',
        'dtwMortalityOnlyInventory',true,'mortalityBatchAllocations',v_mortality_allocations
      ),'1') returning id into v_line_id;
    update public.brd_fc set actual_age=greatest(coalesce(actual_age,0),v_age),updated_by=v_actor where id=v_growing_id;
    v_qty:=coalesce(nullif(v_row->>'feedKg','')::numeric,0);
    if v_qty>0 then
      v_feed_cache_key:=upper(btrim(v_context.building_code));
      v_item:=nullif(v_feed_item_cache->>v_feed_cache_key,'');
      if v_item is null then
        with historical_usage as (
          select upper(btrim(item_code)) item_key,sum(qty) used_qty from public.inventory_postings
          where source_doc_type='BRD_FC_FEED_USAGE' and transfer_type='OUT' group by upper(btrim(item_code))
        ), available as (
          select min(item_code) item_code,upper(btrim(item_code)) item_key
          from public.inventory_postings where upper(btrim(warehouse_code))=v_feed_cache_key
            and nullif(btrim(coalesce(batch_number,ref)),'') is not null
          group by upper(btrim(item_code))
        )
        select available.item_code into v_item from available join historical_usage using(item_key)
        order by historical_usage.used_qty desc,available.item_code limit 1;
        if v_item is not null then v_feed_item_cache:=v_feed_item_cache||jsonb_build_object(v_feed_cache_key,v_item); end if;
      end if;
      if v_item is null then raise exception 'Growing row % cannot find an historically used feed item with a batch in building %.',v_index,v_context.building_code; end if;
      perform pg_advisory_xact_lock(hashtextextended('inventory:'||upper(v_item)||':'||upper(v_context.building_code),0));
      v_remaining:=v_qty; v_line_no:=0;
      for v_allocation in
        select coalesce(posting.batch_number,posting.ref) batch_number,
          sum(case when posting.transfer_type='OUT' then -posting.qty else posting.qty end) on_hand,
          min(batch.manufacturing_date) manufacturing_date,min(batch.expiry_date) expiry_date
        from public.inventory_postings posting
        left join public.item_batches batch on upper(btrim(batch.item_code))=upper(btrim(posting.item_code)) and upper(btrim(batch.batch_number))=upper(btrim(coalesce(posting.batch_number,posting.ref))) and batch.void='1'
        where upper(btrim(posting.item_code))=upper(btrim(v_item)) and upper(btrim(posting.warehouse_code))=upper(btrim(v_context.building_code)) and nullif(btrim(coalesce(posting.batch_number,posting.ref)),'') is not null
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
      if v_remaining>0 then
        select coalesce(posting.batch_number,posting.ref) batch_number,
          sum(case when posting.transfer_type='OUT' then -posting.qty else posting.qty end) on_hand,
          min(batch.manufacturing_date) manufacturing_date,min(batch.expiry_date) expiry_date
        into v_allocation
        from public.inventory_postings posting
        left join public.item_batches batch on upper(btrim(batch.item_code))=upper(btrim(posting.item_code)) and upper(btrim(batch.batch_number))=upper(btrim(coalesce(posting.batch_number,posting.ref))) and batch.void='1'
        where upper(btrim(posting.item_code))=upper(btrim(v_item)) and upper(btrim(posting.warehouse_code))=upper(btrim(v_context.building_code)) and nullif(btrim(coalesce(posting.batch_number,posting.ref)),'') is not null
        group by coalesce(posting.batch_number,posting.ref)
        order by min(batch.expiry_date) nulls last,min(batch.manufacturing_date) nulls last,coalesce(posting.batch_number,posting.ref)
        limit 1;
        if not found then raise exception 'Growing row % cannot find a feed batch for % kg of %.',v_index,v_remaining,v_item; end if;
        v_line_no:=v_line_no+1; v_batch:=v_allocation.batch_number;
        insert into public.brd_fc_ba(created_by,fc_line_id,line_no,item_id,item_code,item_name,batch_no,whse_id,whse_code,whse_name,alloc_qty,onhand_snapshot,mfg_date,exp_date,source,void)
          select v_actor,v_line_id,v_line_no,i.id,i.item_code,i.item_name,v_batch,v_context.building_id,v_context.building_code,v_context.building_name,v_remaining,v_allocation.on_hand,
            coalesce(v_allocation.manufacturing_date,v_date),v_allocation.expiry_date,'DTW_NEGATIVE','1' from public.items i where upper(i.item_code)=upper(v_item) and coalesce(btrim(i.void::text),'1')='1' returning id into v_ba_id;
        insert into public.inventory_postings(source_doc_type,source_docentry,item_code,warehouse_code,bin_code,qty,created_by,ref_type,ref,batch_number,transfer_type,ref_type2,ref2)
          values('BRD_FC_FEED_USAGE',v_ba_id,v_item,v_context.building_code,'MAIN SUB BIN',v_remaining,v_actor,'batch_code',v_batch,v_batch,'OUT','BROILER_DTW',v_context.cycle_key);
        v_warnings:=v_warnings||jsonb_build_array(format('Growing row %s used %s kg negative feed inventory for %s batch %s.',v_index,v_remaining,v_item,v_batch));
        v_remaining:=0;
      end if;
      update public.brd_fc_line set feed_batch_text=(select string_agg(item_code||' - '||batch_no,', ' order by line_no) from public.brd_fc_ba where fc_line_id=v_line_id and void='1') where id=v_line_id;
    end if;
    insert into public.broiler_dtw_import_rows(job_id,stage,row_no,farm_id,building_whse_id,farm_cycle_id,entity_id,raw_data)
      values(
        p_request_id,'Growing',v_index,v_context.farm_id,v_context.building_id,v_context.cycle_id,v_line_id,
        v_row||jsonb_build_object('mortalityInventoryDeducted',v_mortality_total,'mortalityInventoryAllocations',v_mortality_allocations)
      );
    v_growing_count:=v_growing_count+1;
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
      and not exists(select 1 from jsonb_array_elements_text(imported.warnings) warning(value) where warning.value like 'Skipped:%')
    on conflict(dedupe_key) do nothing;
  end if;

  -- Stage 3: Harvest & Delivery.
  v_index:=0;
  for v_row in select value from jsonb_array_elements(p_payload->'harvest') loop
    v_index:=coalesce(nullif(v_row->>'_dtwRowNo','')::integer,v_index+1);
    if v_chunked and exists(select 1 from public.broiler_dtw_import_rows imported where imported.job_id=p_request_id and imported.stage='Harvest Delivery' and imported.row_no=v_index) then continue; end if;
    select * into v_context from private.broiler_dtw_resolve_context(p_request_id,v_row);
    if not found then
      v_warnings:=v_warnings||jsonb_build_array(format(
        'Skipped: Harvest Delivery row %s because Placement Batch %s was not found in Cycle Master for farm %s.',
        v_index,coalesce(nullif(btrim(v_row->>'placementBatch'),''),nullif(btrim(v_row->>'existingCycleKey'),''),'<blank>'),coalesce(v_row->>'farmCode','<blank>')
      ));
      v_harvest_count:=v_harvest_count+1;
      continue;
    end if;
    v_date:=coalesce(nullif(v_row->>'deliveryDate','')::date,current_date);
    if nullif(v_row->>'deliveryDate','') is null or nullif(v_row->>'harvestAge','') is null or nullif(v_row->>'quantity','') is null then
      raise exception 'Harvest row % requires Delivery Date, Harvest Age, and Harvest Quantity.',v_index;
    end if;
    if not v_legacy and coalesce(nullif(v_row->>'quantity','')::numeric,0)>0 and nullif(v_row->>'netLiveWeight','') is not null and nullif(v_row->>'averageLiveWeight','') is not null
      and abs((v_row->>'averageLiveWeight')::numeric-(v_row->>'netLiveWeight')::numeric/(v_row->>'quantity')::numeric)>0.0005 then raise exception 'Harvest row % has an ALW mismatch.',v_index; end if;
    select delivery.id into v_document_id
    from public.br_delivery delivery
    where delivery.status='Posted' and delivery.farm_cycle_id=v_context.cycle_id and delivery.from_warehouse_id=v_context.building_id and delivery.issue_date=v_date
      and exists(
        select 1 from public.br_delivery_lines line
        where line.br_delivery_id=delivery.id and line.void='1'
          and line.harvest_age=(v_row->>'harvestAge')::integer and line.delivered_date=v_date
          and upper(btrim(coalesce(line.hauler_name,'')))=upper(btrim(coalesce(v_row->>'haulerName','')))
          and upper(btrim(coalesce(line.plate_number,'')))=upper(btrim(coalesce(v_row->>'plateNumber','')))
          and upper(btrim(coalesce(line.destination,'')))=upper(btrim(coalesce(v_row->>'destination','')))
          and upper(btrim(coalesce(line.live_sales_customer_name,'')))=upper(btrim(coalesce(v_row->>'customer','')))
        group by line.br_delivery_id
        having sum(line.base_qty)=coalesce(nullif(v_row->>'quantity','')::numeric,0)
      )
    order by delivery.id desc limit 1;
    if found then
      v_warnings:=v_warnings||jsonb_build_array(format('Harvest Delivery row %s skipped because document %s is already Posted.',v_index,v_document_id));
      insert into public.broiler_dtw_import_rows(job_id,stage,row_no,farm_id,building_whse_id,farm_cycle_id,entity_id,raw_data,warnings)
        values(p_request_id,'Harvest Delivery',v_index,v_context.farm_id,v_context.building_id,v_context.cycle_id,v_document_id,v_row,jsonb_build_array('Skipped: a matching Harvest Delivery document is already Posted.'));
      v_harvest_count:=v_harvest_count+1;
      continue;
    end if;
    if exists(select 1 from public.flock_card card where card.id=v_context.flock_card_id and card.status<>'Saved') then
      v_warning:=format('DTW allowed Harvest Delivery rows for already-closed Placement Batch %s.',v_context.cycle_key);
      if not (v_warnings ? v_warning) then v_warnings:=v_warnings||jsonb_build_array(v_warning); end if;
    end if;
    v_doc_no:=format('DTW-BRDR-%s-%s-%s',to_char(v_date,'YY'),left(replace(p_request_id::text,'-',''),6),lpad(v_index::text,4,'0'));
    if exists(select 1 from public.br_delivery where gi_no=v_doc_no) then raise exception 'Harvest document % already exists.',v_doc_no; end if;
    insert into public.br_delivery(created_by,created_at,gi_no,issue_date,farm_id,farm_cycle_id,farm_code,farm_name,from_warehouse_id,from_warehouse_code,from_warehouse_name,triggered_by,status,remarks)
      values(v_actor,v_date,v_doc_no,v_date,v_context.farm_id,v_context.cycle_id,v_context.farm_code,v_context.farm_name,v_context.building_id,v_context.building_code,v_context.building_name,'BR-DR','Posted',nullif(v_row->>'remarks','')) returning id into v_document_id;
    select * into v_good_doc from private.broiler_dtw_good_doc_item(v_context.farm_id); v_item:=v_good_doc.item_code; v_qty:=coalesce(nullif(v_row->>'quantity','')::numeric,0);
    perform pg_advisory_xact_lock(hashtextextended('inventory:'||upper(v_item)||':'||upper(v_context.building_code),0));
    v_remaining:=v_qty; v_line_no:=0;
    for v_allocation in
      select inventory.batch_number,inventory.on_hand,inventory.manufacturing_date
      from private.broiler_dtw_cycle_doc_inventory(v_context.flock_card_id) inventory
      where upper(inventory.item_code)=upper(v_item) and inventory.on_hand>0
      order by inventory.expiry_date nulls last,inventory.manufacturing_date nulls last,inventory.line_no,inventory.batch_number
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
    if v_remaining>0 then
      select inventory.batch_number,inventory.on_hand,inventory.manufacturing_date
      into v_allocation
      from private.broiler_dtw_cycle_doc_inventory(v_context.flock_card_id) inventory
      where upper(inventory.item_code)=upper(v_item)
      order by inventory.expiry_date nulls last,inventory.manufacturing_date nulls last,inventory.line_no,inventory.batch_number
      limit 1;
      if not found then raise exception 'Harvest row % cannot find a cycle DOC Placement batch for % of %.',v_index,v_remaining,v_item; end if;
      v_line_no:=v_line_no+1; v_batch:=v_allocation.batch_number; v_alloc_qty:=v_remaining;
      insert into public.br_delivery_lines(created_by,br_delivery_id,line_no,allocation_group_key,harvest_age,average_live_weight,net_live_weight,delivered_date,hauler_name,plate_number,destination,live_sales_customer_name,truck_seal,
        item_id,item_code,description,batch_number,manufacturing_date,alt_qty,alt_uom,base_qty,base_uom,from_warehouse_id,from_warehouse_code,from_warehouse_name,void)
        values(v_actor,v_document_id,v_line_no,gen_random_uuid()::text,(v_row->>'harvestAge')::integer,nullif(v_row->>'averageLiveWeight','')::numeric,
          case when v_qty>0 then nullif(v_row->>'netLiveWeight','')::numeric*v_alloc_qty/v_qty else null end,v_date,nullif(v_row->>'haulerName',''),nullif(v_row->>'plateNumber',''),nullif(v_row->>'destination',''),nullif(v_row->>'customer',''),nullif(v_row->>'truckSeal','')::numeric,
          v_good_doc.item_id,v_item,v_good_doc.item_name,v_batch,coalesce(v_allocation.manufacturing_date,v_date),v_alloc_qty,'EA',v_alloc_qty,'EA',v_context.building_id,v_context.building_code,v_context.building_name,'1') returning id into v_line_id;
      insert into public.inventory_postings(source_doc_type,source_docentry,item_code,warehouse_code,bin_code,qty,created_by,ref_type,ref,batch_number,transfer_type,ref_type2,ref2)
        values('BR_DELIVERY',v_document_id,v_item,v_context.building_code,'MAIN SUB BIN',v_alloc_qty,v_actor,'batch_code',v_batch,v_batch,'OUT','BROILER_DTW',v_context.cycle_key);
      v_warnings:=v_warnings||jsonb_build_array(format('Harvest row %s used %s negative DOC inventory from batch %s.',v_index,v_alloc_qty,v_batch));
      v_remaining:=0;
    end if;
    if not v_legacy then update public.br_delivery set notification_revision=notification_revision+1,updated_by=v_actor where id=v_document_id; end if;
    insert into public.broiler_dtw_import_rows(job_id,stage,row_no,farm_id,building_whse_id,farm_cycle_id,entity_id,raw_data)
      values(p_request_id,'Harvest Delivery',v_index,v_context.farm_id,v_context.building_id,v_context.cycle_id,v_document_id,v_row); v_harvest_count:=v_harvest_count+1;
  end loop;

  -- Stage 4: Clean Up closes the building and closes Cycle Master when all buildings are complete.
  v_index:=0;
  for v_row in select value from jsonb_array_elements(p_payload->'cleanup') loop
    v_index:=coalesce(nullif(v_row->>'_dtwRowNo','')::integer,v_index+1);
    if v_chunked and exists(select 1 from public.broiler_dtw_import_rows imported where imported.job_id=p_request_id and imported.stage='Clean Up' and imported.row_no=v_index) then continue; end if;
    select * into v_context from private.broiler_dtw_resolve_context(p_request_id,v_row);
    if not found then
      v_warnings:=v_warnings||jsonb_build_array(format(
        'Skipped: Clean Up row %s because Placement Batch %s was not found in Cycle Master for farm %s.',
        v_index,coalesce(nullif(btrim(v_row->>'placementBatch'),''),nullif(btrim(v_row->>'existingCycleKey'),''),'<blank>'),coalesce(v_row->>'farmCode','<blank>')
      ));
      v_cleanup_count:=v_cleanup_count+1;
      continue;
    end if;
    v_date:=coalesce(nullif(v_row->>'cleanupDate','')::date,current_date);
    if nullif(v_row->>'cleanupDate','') is null then raise exception 'Clean Up row % requires Clean Up Date.',v_index; end if;
    select cleanup.id into v_document_id
    from public.br_cleanup cleanup
    where cleanup.status='Posted' and cleanup.farm_cycle_id=v_context.cycle_id and cleanup.from_warehouse_id=v_context.building_id and cleanup.issue_date=v_date
    order by cleanup.id desc limit 1;
    if found then
      v_warnings:=v_warnings||jsonb_build_array(format('Clean Up row %s skipped because document %s is already Posted.',v_index,v_document_id));
      insert into public.broiler_dtw_import_rows(job_id,stage,row_no,farm_id,building_whse_id,farm_cycle_id,entity_id,raw_data,warnings)
        values(p_request_id,'Clean Up',v_index,v_context.farm_id,v_context.building_id,v_context.cycle_id,v_document_id,v_row,jsonb_build_array('Skipped: a matching Clean Up document is already Posted.'));
      v_cleanup_count:=v_cleanup_count+1;
      continue;
    end if;
    if exists(select 1 from public.flock_card card where card.id=v_context.flock_card_id and card.status<>'Saved') then
      v_warning:=format('DTW allowed Clean Up rows for already-closed Placement Batch %s.',v_context.cycle_key);
      if not (v_warnings ? v_warning) then v_warnings:=v_warnings||jsonb_build_array(v_warning); end if;
    end if;
    v_doc_no:=format('DTW-BRCU-%s-%s-%s',to_char(v_date,'YY'),left(replace(p_request_id::text,'-',''),6),lpad(v_index::text,4,'0'));
    if exists(select 1 from public.br_cleanup where gi_no=v_doc_no) then raise exception 'Clean Up document % already exists.',v_doc_no; end if;
    insert into public.br_cleanup(created_by,created_at,gi_no,issue_date,farm_id,farm_cycle_id,farm_code,farm_name,from_warehouse_id,from_warehouse_code,from_warehouse_name,triggered_by,status,remarks)
      values(v_actor,v_date,v_doc_no,v_date,v_context.farm_id,v_context.cycle_id,v_context.farm_code,v_context.farm_name,v_context.building_id,v_context.building_code,v_context.building_name,'BR-CU','Posted',nullif(v_row->>'remarks','')) returning id into v_document_id;
    select * into v_good_doc from private.broiler_dtw_good_doc_item(v_context.farm_id); v_item:=v_good_doc.item_code;
    perform pg_advisory_xact_lock(hashtextextended('inventory:'||upper(v_item)||':'||upper(v_context.building_code),0));
    select greatest(coalesce(sum(inventory.on_hand),0),0) into v_qty
    from private.broiler_dtw_cycle_doc_inventory(v_context.flock_card_id) inventory
    where upper(inventory.item_code)=upper(v_item) and inventory.on_hand>0;
    v_line_no:=0;
    for v_allocation in
      select inventory.batch_number,inventory.on_hand,inventory.manufacturing_date
      from private.broiler_dtw_cycle_doc_inventory(v_context.flock_card_id) inventory
      where upper(inventory.item_code)=upper(v_item) and inventory.on_hand>0
      order by inventory.expiry_date nulls last,inventory.manufacturing_date nulls last,inventory.line_no,inventory.batch_number
    loop
      v_line_no:=v_line_no+1; v_batch:=v_allocation.batch_number; v_alloc_qty:=v_allocation.on_hand;
      insert into public.br_cleanup_lines(created_by,br_cleanup_id,line_no,item_id,item_code,description,remarks,batch_number,manufacturing_date,alt_qty,alt_uom,base_qty,base_uom,batch_total_qty,variance_qty,from_warehouse_id,from_warehouse_code,from_warehouse_name,void)
        values(v_actor,v_document_id,v_line_no,v_good_doc.item_id,v_item,v_good_doc.item_name,nullif(v_row->>'remarks',''),v_batch,coalesce(v_allocation.manufacturing_date,v_date),v_alloc_qty,'EA',v_alloc_qty,'EA',v_alloc_qty,0,
          v_context.building_id,v_context.building_code,v_context.building_name,'1') returning id into v_line_id;
      insert into public.inventory_postings(source_doc_type,source_docentry,item_code,warehouse_code,bin_code,qty,created_by,ref_type,ref,batch_number,transfer_type,ref_type2,ref2)
        values('BR_CLEANUP',v_document_id,v_item,v_context.building_code,'MAIN SUB BIN',v_alloc_qty,v_actor,'batch_code',v_batch,v_batch,'OUT','BROILER_DTW',v_context.cycle_key);
    end loop;
    if exists(
      select 1 from private.broiler_dtw_cycle_doc_inventory(v_context.flock_card_id) inventory
      where inventory.on_hand>0.000001
    ) then
      raise exception 'Clean Up row % did not fully clear the DOC inventory for Placement Batch %.',v_index,v_context.cycle_key;
    end if;
    if v_qty=0 then v_warnings:=v_warnings||jsonb_build_array(format('Clean Up row %s found no remaining Good DOC inventory.',v_index)); end if;
    update public.flock_card set status='Closed',updated_by=v_actor,updated_at=now(),extra=coalesce(extra,'{}')||jsonb_build_object('closed_by_doc_type','BR_CLEANUP','closed_by_docentry',v_document_id,'closed_by_doc_no',v_doc_no,'closed_at',now(),'dtwJobId',p_request_id) where id=v_context.flock_card_id;
    if not exists(select 1 from public.flock_card card where card.farm_cycle_id=v_context.cycle_id and card.void='1' and card.status='Saved') then
      update public.doc_farm_cycles set status='Closed',closed_at=v_date,closed_by=v_actor,updated_at=now(),updated_by=v_actor where id=v_context.cycle_id;
    end if;
    if not v_legacy then update public.br_cleanup set notification_revision=notification_revision+1,updated_by=v_actor where id=v_document_id; end if;
    insert into public.broiler_dtw_import_rows(job_id,stage,row_no,farm_id,building_whse_id,farm_cycle_id,entity_id,raw_data,warnings)
      values(p_request_id,'Clean Up',v_index,v_context.farm_id,v_context.building_id,v_context.cycle_id,v_document_id,v_row,case when v_qty=0 then jsonb_build_array('No inventory movement: no remaining Good DOC inventory.') else '[]' end);
    v_cleanup_count:=v_cleanup_count+1;
  end loop;

  select count(distinct farm_cycle_id),
    count(*) filter (where stage='DOC Placement'),count(*) filter (where stage='Growing'),
    count(*) filter (where stage='Harvest Delivery'),count(*) filter (where stage='Clean Up')
  into v_cycle_count,v_placement_count,v_growing_count,v_harvest_count,v_cleanup_count
  from public.broiler_dtw_import_rows where job_id=p_request_id;
  if v_chunked and v_final_chunk and (
    v_placement_count<>coalesce((p_payload->'expectedCounts'->>'placement')::integer,v_placement_count)
    or v_growing_count<>coalesce((p_payload->'expectedCounts'->>'growing')::integer,v_growing_count)
    or v_harvest_count<>coalesce((p_payload->'expectedCounts'->>'harvest')::integer,v_harvest_count)
    or v_cleanup_count<>coalesce((p_payload->'expectedCounts'->>'cleanup')::integer,v_cleanup_count)
  ) then raise exception 'The resumable DTW import cannot finalize because one or more module batches are incomplete.'; end if;
  v_result:=jsonb_build_object('jobId',p_request_id,'status',case when v_final_chunk then 'Completed' else 'Processing' end,'cycleCount',v_cycle_count,'placementCount',v_placement_count,'growingCount',v_growing_count,'harvestCount',v_harvest_count,'cleanupCount',v_cleanup_count,'warnings',v_warnings);
  update public.broiler_dtw_import_jobs set status=case when v_final_chunk then 'Completed' else 'Processing' end,cycle_count=v_cycle_count,placement_count=v_placement_count,growing_count=v_growing_count,harvest_count=v_harvest_count,cleanup_count=v_cleanup_count,warnings=v_warnings,result=v_result where id=p_request_id;
  return v_result;
end;
$$;

revoke all on function private.import_broiler_dtw_workbook(uuid,jsonb) from public, anon, authenticated;

create or replace function private.finalize_broiler_dtw_import(p_request_id uuid,p_import_hash text)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  v_actor uuid:=auth.uid();
  v_job public.broiler_dtw_import_jobs%rowtype;
  v_expected jsonb;
  v_counts jsonb;
  v_payload jsonb;
  v_result jsonb;
  v_error_code text;
  v_error_message text;
begin
  if v_actor is null then raise exception 'An authenticated user is required to finalize a workbook.' using errcode='42501'; end if;
  if p_request_id is null or nullif(p_import_hash,'') is null then raise exception 'The DTW request identity and content hash are required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into v_job from public.broiler_dtw_import_jobs where id=p_request_id;
  if not found then raise exception 'The staged DTW import job was not found.'; end if;
  if v_job.actor_auth_id<>v_actor or v_job.payload_hash<>p_import_hash then
    raise exception 'Import request ownership or content mismatch.' using errcode='42501';
  end if;
  if v_job.status='Completed' then return v_job.result; end if;
  if v_job.status='Cancelled' then raise exception 'This DTW import was cancelled and cannot be finalized.'; end if;
  if exists(select 1 from public.broiler_dtw_import_rows imported where imported.job_id=p_request_id) then
    raise exception 'This is a legacy partial DTW import. Cancel it before starting the workbook again.';
  end if;

  v_expected:=v_job.result->'expectedCounts';
  if jsonb_typeof(v_expected) is distinct from 'object' then raise exception 'The staged DTW job is missing its expected row counts.'; end if;
  select jsonb_build_object(
    'placement',count(*) filter(where stage='placement'),
    'growing',count(*) filter(where stage='growing'),
    'harvest',count(*) filter(where stage='harvest'),
    'cleanup',count(*) filter(where stage='cleanup')
  ) into v_counts
  from private.broiler_dtw_staged_rows where job_id=p_request_id;
  if (v_counts->>'placement')::integer<>(v_expected->>'placement')::integer
    or (v_counts->>'growing')::integer<>(v_expected->>'growing')::integer
    or (v_counts->>'harvest')::integer<>(v_expected->>'harvest')::integer
    or (v_counts->>'cleanup')::integer<>(v_expected->>'cleanup')::integer then
    raise exception 'The staged DTW workbook is incomplete and cannot be finalized.';
  end if;

  v_payload:=jsonb_build_object(
    'mode',v_job.mode,
    'fileName',v_job.file_name,
    'importHash',v_job.payload_hash,
    'warnings',v_job.warnings,
    'placement',coalesce((select jsonb_agg(staged.raw_data order by staged.row_no) from private.broiler_dtw_staged_rows staged where staged.job_id=p_request_id and staged.stage='placement'),'[]'::jsonb),
    'growing',coalesce((select jsonb_agg(staged.raw_data order by staged.row_no) from private.broiler_dtw_staged_rows staged where staged.job_id=p_request_id and staged.stage='growing'),'[]'::jsonb),
    'harvest',coalesce((select jsonb_agg(staged.raw_data order by staged.row_no) from private.broiler_dtw_staged_rows staged where staged.job_id=p_request_id and staged.stage='harvest'),'[]'::jsonb),
    'cleanup',coalesce((select jsonb_agg(staged.raw_data order by staged.row_no) from private.broiler_dtw_staged_rows staged where staged.job_id=p_request_id and staged.stage='cleanup'),'[]'::jsonb),
    'chunked',false,
    'finalChunk',true
  );

  -- Every business write is inside this exception subtransaction. PostgreSQL
  -- rolls the entire block back before the failure audit is persisted below.
  begin
    v_result:=private.import_broiler_dtw_workbook(p_request_id,v_payload);
  exception when others then
    get stacked diagnostics v_error_code=returned_sqlstate,v_error_message=message_text;
    v_result:=jsonb_build_object(
      'jobId',p_request_id,'status','Failed','cycleCount',0,'placementCount',0,'growingCount',0,'harvestCount',0,'cleanupCount',0,
      'warnings',v_job.warnings,'expectedCounts',v_expected,'stagedCounts',v_counts,
      'error',jsonb_build_object('code',v_error_code,'message',v_error_message)
    );
    update public.broiler_dtw_import_jobs
    set status='Failed',cycle_count=0,placement_count=0,growing_count=0,harvest_count=0,cleanup_count=0,result=v_result
    where id=p_request_id;
    return v_result;
  end;

  delete from private.broiler_dtw_staged_rows where job_id=p_request_id;
  return v_result;
end;
$$;

revoke all on function private.finalize_broiler_dtw_import(uuid,text) from public, anon, authenticated;
grant execute on function private.finalize_broiler_dtw_import(uuid,text) to authenticated;

create or replace function public.stage_broiler_dtw_workbook(p_request_id uuid,p_payload jsonb)
returns jsonb language plpgsql security invoker
set search_path = public, private
set statement_timeout = '60s'
as $$
begin
  if auth.uid() is null then raise exception 'An authenticated user is required to stage a workbook.' using errcode='42501'; end if;
  return private.stage_broiler_dtw_workbook(p_request_id,p_payload);
end;
$$;
revoke all on function public.stage_broiler_dtw_workbook(uuid,jsonb) from public, anon;
grant execute on function public.stage_broiler_dtw_workbook(uuid,jsonb) to authenticated;

create or replace function public.finalize_broiler_dtw_import(p_request_id uuid,p_import_hash text)
returns jsonb language plpgsql security invoker
set search_path = public, private
set statement_timeout = '10min'
as $$
begin
  if auth.uid() is null then raise exception 'An authenticated user is required to finalize a workbook.' using errcode='42501'; end if;
  return private.finalize_broiler_dtw_import(p_request_id,p_import_hash);
end;
$$;
revoke all on function public.finalize_broiler_dtw_import(uuid,text) from public, anon;
grant execute on function public.finalize_broiler_dtw_import(uuid,text) to authenticated;

create or replace function public.import_broiler_dtw_workbook(p_request_id uuid,p_payload jsonb)
returns jsonb language plpgsql security invoker
set search_path = public, private
set statement_timeout = '60s'
as $$
begin
  raise exception 'Direct DTW business imports are disabled. Stage the workbook and finalize it atomically.';
end;
$$;
revoke all on function public.import_broiler_dtw_workbook(uuid,jsonb) from public, anon, authenticated;

create or replace function private.cancel_broiler_dtw_import(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  v_actor uuid:=auth.uid();
  v_job public.broiler_dtw_import_jobs%rowtype;
  v_imported record;
  v_growing_id bigint;
  v_voided_count integer:=0;
  v_result jsonb;
begin
  if v_actor is null then raise exception 'An authenticated user is required to cancel an import.' using errcode='42501'; end if;
  if p_request_id is null then raise exception 'An import request identity is required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into v_job from public.broiler_dtw_import_jobs where id=p_request_id;
  if not found then raise exception 'The DTW import job was not found.'; end if;
  if v_job.actor_auth_id<>v_actor then raise exception 'You can only cancel your own DTW import.' using errcode='42501'; end if;
  if v_job.status='Completed' then raise exception 'A completed DTW import cannot be cancelled.'; end if;

  -- Cancel is an atomic void, not just a job-state change. Reverse only rows
  -- actually created by this job; ledger rows marked Skipped point at existing
  -- Posted documents and must remain untouched.
  perform set_config('app.broiler_dtw_suppress_notifications','on',true);
  for v_imported in
    select imported.* from public.broiler_dtw_import_rows imported
    where imported.job_id=p_request_id
      and not exists (
        select 1 from jsonb_array_elements_text(coalesce(imported.warnings,'[]'::jsonb)) warning(value)
        where warning.value like 'Skipped:%'
      )
    order by case imported.stage when 'Clean Up' then 1 when 'Harvest Delivery' then 2 when 'Growing' then 3 else 4 end,
      imported.row_no desc
  loop
    if v_imported.stage='Clean Up' then
      insert into public.inventory_postings(
        source_doc_type,source_docentry,item_code,warehouse_code,bin_code,qty,created_by,
        ref_type,ref,batch_number,transfer_type,ref_type2,ref2,cleanup_reverses_posting_id
      )
      select original.source_doc_type||'_REVERSAL',original.source_docentry,original.item_code,
        original.warehouse_code,original.bin_code,original.qty,v_actor,original.ref_type,original.ref,
        original.batch_number,case when original.transfer_type='OUT' then 'IN' else 'OUT' end,
        original.ref_type2,original.ref2,original.id
      from public.inventory_postings original
      where original.source_docentry=v_imported.entity_id
        and original.source_doc_type in ('BR_CLEANUP','BR_CLEANUP_VARIANCE')
        and not exists(select 1 from public.inventory_postings reversal where reversal.cleanup_reverses_posting_id=original.id);
      update public.flock_card set status='Saved',updated_by=v_actor,updated_at=now(),
        extra=(coalesce(extra,'{}'::jsonb)-'closed_by_doc_type'-'closed_by_docentry'-'closed_by_doc_no'-'closed_at')
          ||jsonb_build_object('reopenedByDtwCancellation',p_request_id,'reopenedAt',now())
      where extra->>'closed_by_doc_type'='BR_CLEANUP' and extra->>'closed_by_docentry'=v_imported.entity_id::text;
      update public.doc_farm_cycles set status='Past Open',closed_at=null,closed_by=null,updated_at=now(),updated_by=v_actor
      where id=v_imported.farm_cycle_id and status='Closed';
      update public.br_cleanup set status='Cancelled',reversed_at=coalesce(reversed_at,now()),reversed_by=coalesce(reversed_by,v_actor),
        reversal_reason=coalesce(reversal_reason,'DTW import cancelled'),updated_at=now(),updated_by=v_actor,
        notification_revision=notification_revision+1
      where id=v_imported.entity_id and status<>'Cancelled';
      if found then v_voided_count:=v_voided_count+1; end if;

    elsif v_imported.stage='Harvest Delivery' then
      insert into public.inventory_postings(
        source_doc_type,source_docentry,item_code,warehouse_code,bin_code,qty,created_by,
        ref_type,ref,batch_number,transfer_type,ref_type2,ref2,delivery_reverses_posting_id
      )
      select 'BR_DELIVERY_REVERSAL',original.source_docentry,original.item_code,original.warehouse_code,
        original.bin_code,original.qty,v_actor,original.ref_type,original.ref,original.batch_number,'IN',
        original.ref_type2,original.ref2,original.id
      from public.inventory_postings original
      where original.source_docentry=v_imported.entity_id and original.source_doc_type='BR_DELIVERY'
        and not exists(select 1 from public.inventory_postings reversal where reversal.delivery_reverses_posting_id=original.id);
      update public.br_delivery set status='Cancelled',reversed_at=coalesce(reversed_at,now()),reversed_by=coalesce(reversed_by,v_actor),
        reversal_reason=coalesce(reversal_reason,'DTW import cancelled'),updated_at=now(),updated_by=v_actor,
        notification_revision=notification_revision+1
      where id=v_imported.entity_id and status<>'Cancelled';
      if found then v_voided_count:=v_voided_count+1; end if;

    elsif v_imported.stage='Growing' then
      select line.fc_id into v_growing_id from public.brd_fc_line line
      where line.id=v_imported.entity_id and line.void='1' for update;
      if found then
        perform public.reverse_brd_fc_feed_intake(v_imported.entity_id,'DTW import cancelled');
        perform public.reverse_brd_fc_mortality_thinning(v_imported.entity_id,'DTW import cancelled');
        update public.brd_fc_line set void='0',updated_by=v_actor,reversed_at=coalesce(reversed_at,now()),
          reversed_by=coalesce(reversed_by,v_actor),reversal_reason=coalesce(reversal_reason,'DTW import cancelled')
        where id=v_imported.entity_id;
        update public.brd_fc header set actual_age=(select max(line.age) from public.brd_fc_line line where line.fc_id=header.id and line.void='1'),
          updated_by=v_actor,updated_at=now()
        where header.id=v_growing_id;
        update public.brd_fc set void='0',status='Cancelled',actual_age=null,updated_by=v_actor,updated_at=now()
        where id=v_growing_id and fc_no like 'DTW-FC-'||left(replace(p_request_id::text,'-',''),8)||'-%'
          and not exists(select 1 from public.brd_fc_line line where line.fc_id=v_growing_id and line.void='1');
        v_voided_count:=v_voided_count+1;
      end if;

    elsif v_imported.stage='DOC Placement' then
      insert into public.inventory_postings(
        source_doc_type,source_docentry,item_code,warehouse_code,bin_code,qty,created_by,
        ref_type,ref,transfer_type,ref_type2,ref2,batch_number,doc_receiving_reverses_posting_id
      )
      select 'DOC_RECEIVING_REVERSAL',original.source_docentry,original.item_code,original.warehouse_code,
        original.bin_code,original.qty,v_actor,original.ref_type,original.ref,'OUT',original.ref_type2,
        original.ref2,original.batch_number,original.id
      from public.inventory_postings original
      where original.source_docentry=v_imported.entity_id and original.source_doc_type='GOODS_RECEIPT'
        and original.transfer_type='IN'
        and not exists(select 1 from public.inventory_postings reversal where reversal.doc_receiving_reverses_posting_id=original.id);
      update public.flock_card_origin origin set void='0',updated_by=v_actor,updated_at=now()
      where origin.void='1' and origin.extra->>'dtwJobId'=p_request_id::text
        and exists(select 1 from public.goods_receipt_doc detail where detail.goods_reciept_id=v_imported.entity_id and detail.flock_card_id=origin.fc_id);
      update public.goods_receipt_doc set void='0',updated_by=v_actor,updated_at=now()
      where goods_reciept_id=v_imported.entity_id and void='1';
      update public.goods_receipt_items set void='0',updated_by=v_actor,updated_at=now()
      where goods_reciept_id=v_imported.entity_id and void='1';
      update public.goods_receipt set status='Reversed',updated_by=v_actor,updated_at=now()
      where id=v_imported.entity_id and status='Posted';
      if found then v_voided_count:=v_voided_count+1; end if;
    end if;
  end loop;

  -- Recalculate/cancel only the Placement cards and Cycle Master rows proven
  -- to have been created by this job. Pre-existing cycles are never cancelled.
  update public.flock_card card set animal_qty=coalesce((
      select sum(origin.animal_qty) from public.flock_card_origin origin where origin.fc_id=card.id and origin.void='1'
    ),0),updated_by=v_actor,updated_at=now()
  where card.id in (select link.flock_card_id from public.broiler_dtw_cycle_links link where link.job_id=p_request_id);
  update public.flock_card card set void='0',status='Cancelled',updated_by=v_actor,updated_at=now()
  where card.extra->>'dtwJobId'=p_request_id::text
    and not exists(select 1 from public.flock_card_origin origin where origin.fc_id=card.id and origin.void='1')
    and not exists(select 1 from public.brd_fc growing where growing.card_no=card.card_no and growing.void='1');
  update public.doc_farm_cycles cycle set status='Cancelled',closed_at=null,closed_by=null,updated_at=now(),updated_by=v_actor
  where exists(select 1 from public.broiler_dtw_cycle_links link where link.job_id=p_request_id and link.farm_cycle_id=cycle.id and link.cycle_created)
    and not exists(select 1 from public.flock_card card where card.farm_cycle_id=cycle.id and card.void='1');
  delete from private.broiler_dtw_staged_rows where job_id=p_request_id;

  v_result:=coalesce(v_job.result,'{}'::jsonb)||jsonb_build_object(
    'jobId',v_job.id,'status','Cancelled','cycleCount',v_job.cycle_count,
    'placementCount',v_job.placement_count,'growingCount',v_job.growing_count,
    'harvestCount',v_job.harvest_count,'cleanupCount',v_job.cleanup_count,
    'voidedCount',v_voided_count,'warnings',coalesce(v_job.warnings,'[]'::jsonb)
  );
  update public.broiler_dtw_import_jobs set status='Cancelled',result=v_result where id=p_request_id;
  return v_result;
end;
$$;
revoke all on function private.cancel_broiler_dtw_import(uuid) from public, anon;
grant execute on function private.cancel_broiler_dtw_import(uuid) to authenticated;

create or replace function public.cancel_broiler_dtw_import(p_request_id uuid)
returns jsonb language plpgsql security invoker
set search_path = public, private
set statement_timeout = '10min'
as $$
begin
  if auth.uid() is null then raise exception 'An authenticated user is required to cancel an import.' using errcode='42501'; end if;
  return private.cancel_broiler_dtw_import(p_request_id);
end;
$$;
revoke all on function public.cancel_broiler_dtw_import(uuid) from public, anon;
grant execute on function public.cancel_broiler_dtw_import(uuid) to authenticated;

commit;

begin;
set local lock_timeout = '15s';

-- Keep negative DOC stock permission scoped to a DTW import transaction. DTW
-- feed and harvest write their own audited postings; only the shared mortality
-- trigger needs compatibility patching. Ordinary Flock Card calls stay strict.
-- Older deployments may still have the superseded one-open-cycle index and a
-- cycle-assignment trigger that rejects every second open cycle. The index is
-- no longer part of the Broiler lifecycle contract, while the trigger bypass
-- below is deliberately limited to an authenticated DTW transaction inserting
-- a row stamped as BROILER_DTW.
drop index if exists public.flock_card_one_open_cycle_per_building_uidx;

do $patch_dtw_cycle_assignment$
declare
  v_proc regprocedure;
  v_definition text;
begin
  v_proc:=to_regprocedure('public.validate_doc_flock_cycle_assignment()');
  if v_proc is not null then
    select pg_get_functiondef(v_proc) into v_definition;
    if position('broiler_dtw_force_cycle_insert' in v_definition)=0 then
      v_definition:=regexp_replace(
        v_definition,
        '([[:space:]]begin[[:space:]])',
        E'\\1  if current_setting(''app.broiler_dtw_force_cycle_insert'', true) = ''on''\n    and auth.uid() is not null\n    and current_user not in (''anon'', ''authenticated'')\n    and coalesce(new.extra->>''createdFrom'', '''') = ''BROILER_DTW'' then return new; end if;\n',
        'i'
      );
      if position('broiler_dtw_force_cycle_insert' in v_definition)=0 then
        raise exception 'DTW cycle override could not patch public.validate_doc_flock_cycle_assignment() because its function shape is unsupported.';
      end if;
      execute v_definition;
    end if;
  end if;
end;
$patch_dtw_cycle_assignment$;

do $patch_dtw_negative_inventory$
declare
  v_proc regprocedure;
  v_definition text;
begin
  v_proc:=to_regprocedure('public.post_brd_fc_mortality_thinning_inventory()');
  if v_proc is not null then
    select pg_get_functiondef(v_proc) into v_definition;
    if position('broiler_dtw_allow_negative_inventory' in v_definition)=0 then
      v_definition:=regexp_replace(
        v_definition,
        'if[[:space:]]+v_allocation[.]alloc_qty[[:space:]]*>[[:space:]]*v_on_hand[[:space:]]+then',
        E'if v_allocation.alloc_qty > v_on_hand\n      and current_setting(''app.broiler_dtw_allow_negative_inventory'', true) is distinct from ''on'' then',
        'i'
      );
      if position('broiler_dtw_allow_negative_inventory' in v_definition)=0 then
        raise exception 'DTW negative inventory support could not patch public.post_brd_fc_mortality_thinning_inventory() because its function shape is unsupported.';
      end if;
      execute v_definition;
    end if;
  end if;
end;
$patch_dtw_negative_inventory$;

-- Legacy DTW may preserve historical mortality/thinning quantities for which
-- no reconstructable batch inventory exists. Patch only the deferred balance
-- assertion. Posting shortages use the separate transaction-local DTW flag
-- above; every non-DTW transaction stays enforced.
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

-- A DTW cancellation is one bulk user action. Its document reversals are
-- audit-preserving but must not publish thousands of per-row notifications.
do $patch_cancel_notifications$
declare
  v_name text;
  v_proc regprocedure;
  v_definition text;
begin
  foreach v_name in array array[
    'public.enqueue_brd_fc_reversal_event',
    'public.enqueue_br_delivery_event',
    'public.enqueue_br_cleanup_event'
  ] loop
    v_proc:=to_regprocedure(v_name||'()');
    if v_proc is not null then
      select pg_get_functiondef(v_proc) into v_definition;
      if position('broiler_dtw_suppress_notifications' in v_definition)=0 then
        v_definition:=regexp_replace(
          v_definition,
          '([[:space:]]begin[[:space:]])',
          E'\\1  if current_setting(''app.broiler_dtw_suppress_notifications'', true) = ''on'' then return new; end if;\n',
          'i'
        );
        if position('broiler_dtw_suppress_notifications' in v_definition)=0 then
          raise exception 'DTW cancellation notification suppression could not patch % because its function shape is unsupported.',v_name;
        end if;
        execute v_definition;
      end if;
    end if;
  end loop;
end;
$patch_cancel_notifications$;

notify pgrst, 'reload schema';
commit;
