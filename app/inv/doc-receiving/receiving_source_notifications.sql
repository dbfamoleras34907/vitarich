-- Apply after receiving_sources.sql and the updated notification_system.sql.
begin;
create table if not exists public.receiving_flow_event_state (
  module_key text not null, entity_id bigint not null, revision integer not null default 0,
  fingerprint text not null, posted boolean not null, active boolean not null,
  primary key(module_key,entity_id)
);
create table if not exists public.receiving_flow_event_revisions (
  module_key text not null, entity_id bigint not null, revision integer not null,
  event_key text not null, entity_type text not null, farm_id bigint references public.farms(id),
  actor_auth_id uuid references auth.users(id), occurred_at timestamptz not null,
  primary key(module_key,entity_id,revision)
);
alter table public.receiving_flow_event_state enable row level security;
alter table public.receiving_flow_event_revisions enable row level security;
revoke all on public.receiving_flow_event_state,public.receiving_flow_event_revisions from public,anon,authenticated;

create or replace function public.capture_receiving_flow_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_module text:=tg_argv[0]; v_id bigint; v_header jsonb; v_lines jsonb; v_old public.receiving_flow_event_state%rowtype;
  v_hash text; v_posted boolean; v_active boolean; v_action text; v_farm bigint; v_type text; v_fms text; v_group text; v_title text; v_url text; v_doc text; v_revision integer; v_actor uuid; v_at timestamptz:=transaction_timestamp();
begin
  if v_module='HATCHERY_RECEIVING' then
    v_id:=case when tg_table_name='recieving' then (to_jsonb(new)->>'id')::bigint else (to_jsonb(new)->>'docentry')::bigint end;
    select to_jsonb(r) into v_header from public.recieving r where id=v_id;
    select coalesce(jsonb_agg(to_jsonb(i)-array['id','created_at'] order by i.id),'[]') into v_lines from public.recieving_items i where docentry=v_id;
    v_posted:=exists(select 1 from public.inventory_postings where source_doc_type='RECEIVING' and source_docentry=v_id);
    v_active:=coalesce((v_header->>'void')::integer,1)=1;
    v_farm:=(v_header->>'farm_id')::bigint; v_type:='recieving'; v_fms:='Hatchery'; v_group:='Hatchery Masters'; v_title:='Receiving/view';
    v_url:='/a_dean/receiving'; v_doc:=v_header->>'dr_num';
  elsif v_module='DOC_RECEIVING' then
    v_id:=case when tg_table_name='goods_receipt' then (to_jsonb(new)->>'id')::bigint else (to_jsonb(new)->>'goods_reciept_id')::bigint end;
    select to_jsonb(r) into v_header from public.goods_receipt r where id=v_id;
    if not exists(select 1 from public.goods_receipt_doc where goods_reciept_id=v_id and void='1') then return null; end if;
    select coalesce(jsonb_agg(to_jsonb(d)-array['id','created_at','updated_at','updated_by'] order by d.line_no),'[]') into v_lines from public.goods_receipt_doc d where goods_reciept_id=v_id and void='1';
    v_lines:=v_lines||(select coalesce(jsonb_agg(to_jsonb(i)-array['id','created_at','updated_at','updated_by'] order by i.line_no),'[]') from public.goods_receipt_items i where goods_reciept_id=v_id and void='1');
    v_posted:=v_header->>'status' in ('Posted','Received'); v_active:=v_header->>'status' not in ('Cancelled','Reversed');
    v_farm:=(v_header->>'farm_id')::bigint; v_type:='goods_receipt'; v_fms:='Broiler'; v_group:='Menus'; v_title:='DOC Placement/view';
    v_url:='/inv/doc-receiving/post?id='||v_id; v_doc:=v_header->>'gr_no';
  elsif v_module='BREEDER_DISPATCH' then
    v_id:=case when tg_table_name='tbl_brd_dispatch' then (to_jsonb(new)->>'id')::bigint else (to_jsonb(new)->>'dispatch_id')::bigint end;
    select to_jsonb(r) into v_header from public.tbl_brd_dispatch r where id=v_id;
    select coalesce(jsonb_agg(to_jsonb(l)-array['id','created_at','updated_at','updated_by'] order by l.line_no),'[]') into v_lines from public.tbl_brd_dispatch_line l where dispatch_id=v_id;
    v_posted:=v_header->>'status'='Posted'; v_active:=v_header->>'status'<>'Cancelled';
    v_farm:=(v_header->>'farm_id')::bigint; v_type:='tbl_brd_dispatch'; v_fms:='Breeder'; v_group:='Breeder Masters'; v_title:='Breeder Dispatch/view';
    v_url:='/jmb/breederdispatch'; v_doc:=v_header->>'document_no';
  elsif v_module='HATCHERY_DOC_DISPATCH' then
    v_id:=case when tg_table_name='dispatch_doc' then (to_jsonb(new)->>'id')::bigint else (to_jsonb(new)->>'dispatch_doc_id')::bigint end;
    select to_jsonb(r) into v_header from public.dispatch_doc r where id=v_id;
    select coalesce(jsonb_agg(to_jsonb(l)-array['id','created_at','updated_at','updated_by'] order by l.id),'[]') into v_lines from public.dispatch_doc_item l where dispatch_doc_id=v_id;
    v_posted:=v_header->>'status'='Posted'; v_active:=coalesce((v_header->>'is_active')::boolean,false);
    v_farm:=(v_header->>'destination_farm_id')::bigint; v_type:='dispatch_doc'; v_fms:='Hatchery'; v_group:='Menus'; v_title:='DOC Placement/view';
    v_url:='/inv/doc-receiving/new'; v_doc:=v_header->>'dr_no';
  else raise exception 'Unknown receiving flow notification module'; end if;
  if v_header is null then return null; end if;
  v_actor:=coalesce(auth.uid(),nullif(v_header->>'updated_by','')::uuid,nullif(v_header->>'created_by','')::uuid);
  -- This lock and final persisted snapshot collapse all line/header triggers into one event.
  perform pg_advisory_xact_lock(hashtextextended('receiving-event:'||v_module||':'||v_id,0));
  v_hash:=md5(((v_header-array['created_at','updated_at','updated_by','posting_version','posted_at','posted_by'])||jsonb_build_object('lines',v_lines))::text);
  select * into v_old from public.receiving_flow_event_state where module_key=v_module and entity_id=v_id;
  if found and v_old.fingerprint=v_hash then return null; end if;
  v_revision:=coalesce(v_old.revision,0)+1;
  v_action:=case when not v_active and coalesce(v_old.active,true) then 'VOIDED'
    when v_posted and not coalesce(v_old.posted,false) and (
      v_old.module_key is not null or tg_op='INSERT' or
      (tg_table_name in ('goods_receipt','tbl_brd_dispatch','dispatch_doc') and to_jsonb(old)->>'status'='Draft')
    ) then 'POSTED'
    when v_old.module_key is not null or tg_op='UPDATE' then 'EDITED' end;
  insert into public.receiving_flow_event_state values(v_module,v_id,v_revision,v_hash,v_posted,v_active)
    on conflict(module_key,entity_id) do update set revision=excluded.revision,fingerprint=excluded.fingerprint,posted=excluded.posted,active=excluded.active;
  if v_action is null then return null; end if;
  if not exists(select 1 from public.farms where id=v_farm) then v_farm:=null; end if;
  insert into public.receiving_flow_event_revisions values(v_module,v_id,v_revision,v_module||'_'||v_action,v_type,v_farm,v_actor,v_at);
  insert into public.notification_outbox(module_key,event_key,entity_type,entity_id,document_no,fms_type,farm_id,recipient_farm_id,actor_auth_id,target_url,permission_group,permission_title,title,message,posting_version,metadata,dedupe_key,occurred_at,status,last_error)
    values(v_module,v_module||'_'||v_action,v_type,v_id::text,v_doc,v_fms,v_farm,v_farm,v_actor,v_url,v_group,v_title,
      replace(v_module,'_',' ')||' '||lower(v_action),coalesce(v_doc,v_id::text)||' '||lower(v_action),v_revision,
      jsonb_build_object('farm_routing',case when v_module='HATCHERY_DOC_DISPATCH' then 'destination' else 'document' end,'changed_fields',case when v_action='EDITED' and tg_op='UPDATE' then
        (select coalesce(jsonb_agg(key),'[]') from jsonb_each(to_jsonb(new)) where value is distinct from to_jsonb(old)->key and key not in ('updated_at','updated_by')) else '[]'::jsonb end),
      'RECEIVING_FLOW:'||v_module||':'||v_id||':'||v_revision,v_at,case when v_farm is null then 'invalid' else 'pending' end,
      case when v_farm is null then 'Required canonical source farm is missing; delivery is blocked.' end)
    on conflict(dedupe_key) do nothing;
  return null;
end $$;

create or replace function public.receiving_flow_event_valid(e public.notification_outbox)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_farm bigint;
begin
  if e.entity_id !~ '^[0-9]+$' or e.farm_id is null or e.recipient_farm_id is distinct from e.farm_id then return false; end if;
  if e.fms_type is distinct from (case e.module_key when 'DOC_RECEIVING' then 'Broiler' when 'BREEDER_DISPATCH' then 'Breeder' else 'Hatchery' end) then return false; end if;
  if not exists(select 1 from public.receiving_flow_event_revisions r join public.farms f on f.id=r.farm_id
    where r.module_key=e.module_key and r.entity_id=e.entity_id::bigint and r.revision=e.posting_version and r.event_key=e.event_key
      and r.entity_type=e.entity_type and r.farm_id=e.farm_id and r.actor_auth_id is not distinct from e.actor_auth_id and r.occurred_at=e.occurred_at
      and e.dedupe_key='RECEIVING_FLOW:'||r.module_key||':'||r.entity_id||':'||r.revision) then return false; end if;
  case e.module_key
    when 'HATCHERY_RECEIVING' then select farm_id into v_farm from public.recieving where id=e.entity_id::bigint;
    when 'DOC_RECEIVING' then select farm_id into v_farm from public.goods_receipt where id=e.entity_id::bigint;
    when 'BREEDER_DISPATCH' then select farm_id into v_farm from public.tbl_brd_dispatch where id=e.entity_id::bigint;
    when 'HATCHERY_DOC_DISPATCH' then select destination_farm_id into v_farm from public.dispatch_doc where id=e.entity_id::bigint;
    else return false;
  end case;
  return coalesce(v_farm=e.farm_id,false);
end $$;

do $$ declare t text; m text; begin
  foreach t in array array['recieving','recieving_items','goods_receipt','goods_receipt_doc','goods_receipt_items','tbl_brd_dispatch','tbl_brd_dispatch_line','dispatch_doc','dispatch_doc_item'] loop
    m:=case when t in ('recieving','recieving_items') then 'HATCHERY_RECEIVING'
      when t in ('goods_receipt','goods_receipt_doc','goods_receipt_items') then 'DOC_RECEIVING'
      when t in ('tbl_brd_dispatch','tbl_brd_dispatch_line') then 'BREEDER_DISPATCH' else 'HATCHERY_DOC_DISPATCH' end;
    execute format('drop trigger if exists receiving_flow_notification on public.%I',t);
    execute format('create constraint trigger receiving_flow_notification after insert or update on public.%I deferrable initially deferred for each row execute function public.capture_receiving_flow_event(%L)',t,m);
  end loop;
end $$;
revoke all on function public.capture_receiving_flow_event(),public.receiving_flow_event_valid(public.notification_outbox) from public,anon,authenticated;
commit;
