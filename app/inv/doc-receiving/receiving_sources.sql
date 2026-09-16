-- Apply notification_system.sql and the existing receiving/GR schema first.
-- This migration never rewrites historical stock or infers historical sources.
begin;

alter table public.recieving add column if not exists farm_id bigint references public.farms(id);
alter table public.recieving add column if not exists origin_farm_id bigint references public.farms(id);
alter table public.recieving add column if not exists destination_farm_id bigint references public.farms(id);
alter table public.recieving_items add column if not exists source_allocations jsonb not null default '[]';
alter table public.goods_receipt_doc add column if not exists source_allocations jsonb not null default '[]';
alter table public.goods_receipt_items add column if not exists source_dispatch_line_id bigint references public.dispatch_doc_item(id);
alter table public.goods_receipt_items add column if not exists source_ref2 text;

create table if not exists public.receiving_source_links (
  id bigint generated always as identity primary key,
  receiving_item_id bigint references public.recieving_items(id),
  doc_detail_id bigint references public.goods_receipt_doc(id),
  breeder_line_id bigint references public.tbl_brd_dispatch_line(id),
  doc_dispatch_line_id bigint references public.dispatch_doc_item(id),
  placement_id bigint references public.tbl_placement(id),
  placement_date date,
  source_reference text not null,
  document_no text not null,
  farm_id bigint not null references public.farms(id),
  quantity numeric not null check (quantity > 0 and quantity = trunc(quantity)),
  shortage numeric not null default 0 check (shortage >= 0 and shortage = trunc(shortage)),
  doa numeric not null default 0 check (doa >= 0 and doa = trunc(doa)),
  rejects numeric not null default 0 check (rejects >= 0 and rejects = trunc(rejects)),
  receiving_batch text,
  historical boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (shortage + doa + rejects <= quantity),
  check ((receiving_item_id is not null and breeder_line_id is not null and doc_detail_id is null and doc_dispatch_line_id is null)
      or (doc_detail_id is not null and doc_dispatch_line_id is not null and receiving_item_id is null and breeder_line_id is null)),
  unique(receiving_item_id, breeder_line_id), unique(doc_detail_id, doc_dispatch_line_id)
);
create index if not exists receiving_source_breeder_idx on public.receiving_source_links(breeder_line_id);
create index if not exists receiving_source_doc_idx on public.receiving_source_links(doc_dispatch_line_id);

create table if not exists public.receiving_save_requests (
  request_id uuid primary key, actor_id uuid not null references auth.users(id),
  kind text not null check(kind in ('hatchery','broiler')), receipt_id bigint,
  fingerprint text not null, result jsonb, created_at timestamptz not null default now()
);
create table if not exists public.receiving_batch_assignments (
  kind text not null check(kind in ('hatchery','broiler')), receipt_id bigint not null,
  source_key text not null, item_code text not null, batch_number text not null,
  primary key(kind,receipt_id,source_key,item_code)
);
alter table public.receiving_source_links enable row level security;
alter table public.receiving_save_requests enable row level security;
alter table public.receiving_batch_assignments enable row level security;
revoke all on public.receiving_source_links,public.receiving_save_requests,public.receiving_batch_assignments from public,anon,authenticated;

create or replace function public.require_receiving_source_access(p_kind text,p_farm_id bigint,p_action text)
returns void language plpgsql security definer set search_path = public,pg_temp as $$
declare u public.users%rowtype; v_fms text; v_group text; v_title text;
begin
  if p_kind is null or p_action is null or p_kind not in ('hatchery','broiler') or p_action not in ('view','insert','edit','void','link') then raise exception 'Invalid receiving operation'; end if;
  select * into u from public.users where auth_id=auth.uid() and isactive::text='1';
  if not found then raise exception 'An active authenticated user is required' using errcode='42501'; end if;
  v_fms := case p_kind when 'hatchery' then 'Hatchery' else 'Broiler' end;
  if not exists(select 1 from public.farms where id=p_farm_id and void::text='1' and approval_status='approved' and upper(farm_type)=case p_kind when 'hatchery' then 'HA' else 'BR' end) then
    raise exception 'A canonical % destination farm is required',v_fms;
  end if;
  if u.user_type=1 then return; end if;
  if lower(u.fms_type) is distinct from lower(v_fms) or not exists(select 1 from public.users_farms where users_id=u.id and farm_id=p_farm_id and void::text='1') then
    raise exception 'No access to this receiving farm' using errcode='42501';
  end if;
  v_group:=case p_kind when 'hatchery' then 'Hatchery Masters' else 'Menus' end;
  v_title:=case p_kind when 'hatchery' then 'Receiving/' else 'DOC Placement/' end;
  -- Receiving has no ordinary edit action. Historical linking uses its insert permission.
  if not exists(select 1 from public.user_permissions where user_id=auth.uid() and group_name=v_group
    and title=v_title || case when p_action='link' and p_kind='hatchery' then 'insert' when p_action='link' then 'edit' else p_action end
    and is_visible=true) then raise exception 'Receiving permission is required' using errcode='42501'; end if;
end $$;

create or replace function public.list_receiving_sources(p_kind text,p_farm_id bigint,p_receipt_id bigint default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  perform public.require_receiving_source_access(p_kind,p_farm_id,'view');
  -- An exclusion is allowed only for a receipt belonging to this farm.
  if p_receipt_id is not null and not (
    (p_kind='hatchery' and exists(select 1 from public.recieving where id=p_receipt_id and coalesce(farm_id,delivered_to)=p_farm_id)) or
    (p_kind='broiler' and exists(select 1 from public.goods_receipt where id=p_receipt_id and farm_id=p_farm_id))
  ) then raise exception 'Receiving farm mismatch' using errcode='42501'; end if;
  if p_kind='hatchery' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q."documentId" desc,q."sourceLineId"),'[]') into result from (
      select l.id "sourceLineId",h.id "documentId",h.document_no "documentNo",p.placement_date::text "sourceReference",
        p.id "placementId",p.placement_date "placementDate",l.source_date "productionDate",l.category_label "description",p.building_no "buildingName",
        f.code "originFarmCode",f.name "originFarmName",l.dispatch_qty "dispatchedQuantity",
        l.dispatch_qty-coalesce((select sum(a.quantity) from public.receiving_source_links a
          join public.recieving_items i on i.id=a.receiving_item_id join public.recieving r on r.id=i.docentry
          where a.breeder_line_id=l.id and r.void=1 and (p_receipt_id is null or r.id<>p_receipt_id)),0) "remainingQuantity"
      from public.tbl_brd_dispatch h join public.tbl_brd_dispatch_line l on l.dispatch_id=h.id
      join public.tbl_placement p on p.id=l.placement_id and p.farm_id=h.farm_id
      join public.farms f on f.id=h.farm_id
      where h.status='Posted' and h.farm_destination_id=p_farm_id and l.source_type='Egg Laying'
    ) q where q."remainingQuantity">0;
  else
    select coalesce(jsonb_agg(to_jsonb(q) order by q."documentId" desc,q."sourceLineId"),'[]') into result from (
      select l.id "sourceLineId",h.id "documentId",h.dr_no "documentNo",l.doc_batch_code "sourceReference",
        null::bigint "placementId",null::date "placementDate",null::date "productionDate",l.sku_name "description",''::text "buildingName",
        ''::text "originFarmCode",'Hatchery'::text "originFarmName",l.qty "dispatchedQuantity",
        l.qty-coalesce((select sum(a.quantity) from public.receiving_source_links a
          join public.goods_receipt_doc d on d.id=a.doc_detail_id join public.goods_receipt r on r.id=d.goods_reciept_id
          where a.doc_dispatch_line_id=l.id and d.void='1' and r.status in ('Posted','Received')
          and (p_receipt_id is null or r.id<>p_receipt_id)),0) "remainingQuantity"
      from public.dispatch_doc h join public.dispatch_doc_item l on l.dispatch_doc_id=h.id
      where h.status='Posted' and h.is_active and h.destination_farm_id=p_farm_id and nullif(btrim(l.doc_batch_code),'') is not null
        and l.classification='SALEABLE'
    ) q where q."remainingQuantity">0;
  end if;
  return result;
end $$;

-- Atomic series allocation; reuse is limited to this receipt and its source.
create or replace function public.receiving_new_batch(p_kind text,p_receipt_id bigint,p_source_key text,p_item_code text,p_mfg date,p_expiry date,p_rule_id bigint default null)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare v_batch text; v_series public.batch_number_series%rowtype; v_item public.items%rowtype; v_rule bigint; v_rule_id bigint; v_farm bigint; v_seq text; v_mfg text; v_exp text;
begin
  p_source_key:=p_source_key||':'||coalesce(p_mfg::text,'')||':'||coalesce(p_expiry::text,'');
  perform pg_advisory_xact_lock(hashtextextended('receiving-batch:'||p_kind||':'||p_receipt_id,0));
  select batch_number into v_batch from public.receiving_batch_assignments where kind=p_kind and receipt_id=p_receipt_id and source_key=p_source_key and item_code=p_item_code;
  if found then return v_batch; end if;
  select * into v_item from public.items where item_code=p_item_code and void::text='1';
  if not found then raise exception 'Invalid receiving item %',p_item_code; end if;
  if p_kind='hatchery' then select farm_id into v_farm from public.recieving where id=p_receipt_id;
  else select farm_id into v_farm from public.goods_receipt where id=p_receipt_id; end if;
  select series_id,id into v_rule,v_rule_id from public.batch_rules where active and void='1' and auto_generate
    and (p_rule_id is null or id=p_rule_id) and (item_id is null or item_id=v_item.id)
    and (branch_id is null or branch_id=v_farm)
    and (item_group_id is null or item_group_id::text=v_item.item_group or exists(select 1 from public.item_groups g where g.id=item_group_id and upper(g.code)=upper(v_item.item_group)))
    and (p_rule_id is not null or warehouse_id is null or (p_kind='hatchery' and warehouse_id=(select id from public.i_warehouse where whse_code='MAIN' limit 1)))
    order by ((item_id is not null)::integer+(item_group_id is not null)::integer+(branch_id is not null)::integer+(warehouse_id is not null)::integer) desc,id limit 1;
  if v_rule is null then
    if p_rule_id is not null then raise exception 'The selected receiving batch rule is not an eligible automatic rule'; end if;
    -- Match the Item Stock In fallback template, allocating under an item lock
    -- so separate receiving documents never reuse its generated number.
    perform pg_advisory_xact_lock(hashtextextended('receiving-fallback:'||p_item_code,0));
    v_series.prefix:='FD'; v_series.separator:='-'; v_series.next_number:=1;
    v_series.number_length:=5; v_series.date_format:='YYMMDD';
    v_series.include_expiry_date:=p_expiry is not null;
  else
    select * into v_series from public.batch_number_series where id=v_rule and active and void='1' for update;
    if not found then raise exception 'Active receiving batch series is required'; end if;
  end if;
  if p_mfg is null then raise exception 'Production date is required for new receiving batches'; end if;
  if v_series.include_expiry_date and p_expiry is null then raise exception 'Expiry date is required by batch series %',v_series.code; end if;
  v_mfg:=case when v_series.date_format='NONE' then null else to_char(p_mfg,v_series.date_format) end;
  v_exp:=case when v_series.include_expiry_date and v_series.date_format<>'NONE' then to_char(p_expiry,v_series.date_format) end;
  loop
    v_seq:=lpad(v_series.next_number::text,greatest(v_series.number_length,length(v_series.next_number::text)),'0');
    v_batch:=array_to_string(array_remove(array[nullif(v_series.prefix,''),v_mfg,v_exp,v_seq,nullif(v_series.suffix,'')],null),v_series.separator);
    v_series.next_number:=v_series.next_number+1;
    exit when not exists(select 1 from public.item_batches where batch_number=v_batch and item_code=p_item_code);
  end loop;
  update public.batch_number_series set next_number=v_series.next_number,updated_by=auth.uid(),updated_at=now() where id=v_series.id;
  insert into public.item_batches(item_id,item_code,batch_number,manufacturing_date,expiry_date,source_gr_id,status,created_by,batch_rule_id)
    values(v_item.id,p_item_code,v_batch,p_mfg,p_expiry,case when p_kind='broiler' then p_receipt_id else null end,'Active',auth.uid(),v_rule_id);
  insert into public.receiving_batch_assignments values(p_kind,p_receipt_id,p_source_key,p_item_code,v_batch);
  return v_batch;
end $$;

create or replace function public.set_receiving_source_links(p_kind text,p_line_id bigint,p_allocations jsonb,p_historical boolean default false)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_farm bigint; v_receipt bigint; v_expected numeric; v_actual numeric; v_doa numeric:=0; v_rejects numeric:=0;
  v_consumed numeric; v_available numeric; v_source_id bigint; v_parent bigint; v_placement bigint; v_date date; v_ref text; v_doc text;
  v_qty numeric; v_short numeric; v_bad numeric; v_rej numeric; v_sum numeric:=0; v_actual_sum numeric:=0; v_doa_sum numeric:=0; v_reject_sum numeric:=0;
  a jsonb; v_batch text; v_item text; v_mfg date; v_exp date; v_canonical jsonb:='[]'; v_status text;
begin
  if jsonb_typeof(p_allocations) is distinct from 'array' then raise exception 'Source allocations must be an array'; end if;
  if p_kind='hatchery' then
    select coalesce(h.farm_id,h.delivered_to),h.id,coalesce(i.expected_count,i.actual_count),i.actual_count,i.sku,nullif(i.prod_date,'')::date,h.status
      into v_farm,v_receipt,v_expected,v_actual,v_item,v_mfg,v_status
      from public.recieving_items i join public.recieving h on h.id=i.docentry where i.id=p_line_id and h.void=1 for update of h;
  elsif p_kind='broiler' then
    select h.farm_id,h.id,d.quantity_received,d.actual_received,coalesce(d.doa_quantity,0),coalesce(d.reject_count,0),h.status
      into v_farm,v_receipt,v_expected,v_actual,v_doa,v_rejects,v_status
      from public.goods_receipt_doc d join public.goods_receipt h on h.id=d.goods_reciept_id where d.id=p_line_id and d.void='1' for update of h;
  else raise exception 'Invalid receiving kind'; end if;
  if v_receipt is null then raise exception 'Active receiving line not found'; end if;
  if p_historical then perform public.require_receiving_source_access(p_kind,v_farm,'link'); end if;
  if p_kind='hatchery' then
    update public.recieving r set farm_id=v_farm,destination_farm_id=v_farm,
      origin_farm_id=(select id from public.farms f where f.code=r."soldTo" and upper(f.farm_type)='BE') where r.id=v_receipt;
  end if;
  if p_historical and p_kind='broiler' and v_status not in ('Posted','Received') then raise exception 'Link Source is only for posted receivings'; end if;
  if exists(select 1 from jsonb_array_elements(p_allocations) x group by x->>'sourceLineId' having count(*)>1) then raise exception 'Duplicate source line allocation'; end if;
  -- Historical links are append-once. Identical retries are accepted below.
  if p_historical and exists(select 1 from public.receiving_source_links where receiving_item_id=case when p_kind='hatchery' then p_line_id end or doc_detail_id=case when p_kind='broiler' then p_line_id end) then
    if (select jsonb_agg(jsonb_build_object('sourceLineId',coalesce(breeder_line_id,doc_dispatch_line_id),'quantity',quantity,'shortage',shortage,'doa',doa,'rejects',rejects) order by coalesce(breeder_line_id,doc_dispatch_line_id))
      from public.receiving_source_links where receiving_item_id=case when p_kind='hatchery' then p_line_id end or doc_detail_id=case when p_kind='broiler' then p_line_id end)
      = (select jsonb_agg(jsonb_build_object('sourceLineId',(x->>'sourceLineId')::bigint,'quantity',(x->>'quantity')::numeric,'shortage',coalesce((x->>'shortage')::numeric,0),'doa',coalesce((x->>'doa')::numeric,0),'rejects',coalesce((x->>'rejects')::numeric,0)) order by (x->>'sourceLineId')::bigint) from jsonb_array_elements(p_allocations) x) then return; end if;
    raise exception 'This receiving line is already linked. Its verified historical links cannot be overwritten';
  end if;
  delete from public.receiving_source_links where receiving_item_id=case when p_kind='hatchery' then p_line_id end or doc_detail_id=case when p_kind='broiler' then p_line_id end;
  for a in select value from jsonb_array_elements(p_allocations) order by (value->>'sourceLineId')::bigint loop
    v_source_id:=(a->>'sourceLineId')::bigint; v_qty:=(a->>'quantity')::numeric;
    v_short:=coalesce((a->>'shortage')::numeric,0); v_bad:=coalesce((a->>'doa')::numeric,0); v_rej:=coalesce((a->>'rejects')::numeric,0);
    if v_qty is null or v_qty<=0 or v_qty<>trunc(v_qty) or v_short<0 or v_bad<0 or v_rej<0 or v_short<>trunc(v_short) or v_bad<>trunc(v_bad) or v_rej<>trunc(v_rej) or v_short+v_bad+v_rej>v_qty then raise exception 'Invalid base quantity allocation'; end if;
    v_placement:=null; v_date:=null; v_batch:=null;
    if p_kind='hatchery' then
      select h.id into v_parent from public.tbl_brd_dispatch_line l join public.tbl_brd_dispatch h on h.id=l.dispatch_id where l.id=v_source_id for update of h;
      select l.dispatch_qty,p.id,p.placement_date,p.placement_date::text,h.document_no
        into v_available,v_placement,v_date,v_ref,v_doc from public.tbl_brd_dispatch_line l
        join public.tbl_brd_dispatch h on h.id=l.dispatch_id join public.tbl_placement p on p.id=l.placement_id and p.farm_id=h.farm_id
        where l.id=v_source_id and h.status='Posted' and h.farm_destination_id=v_farm and l.source_type='Egg Laying';
      if not found then raise exception 'Breeder source must be a posted egg dispatch to this farm with a valid placement'; end if;
      if exists(select 1 from public.recieving r join public.tbl_brd_dispatch h on h.id=v_parent where r.id=v_receipt and r.origin_farm_id is not null and r.origin_farm_id<>h.farm_id) then raise exception 'The dispatch breeder farm does not match Delivered From'; end if;
      if v_bad<>0 or v_rej<>0 then raise exception 'Hatchery egg receipts use allocated and shortage counts'; end if;
      select coalesce(sum(a.quantity),0) into v_consumed from public.receiving_source_links a join public.recieving_items i on i.id=a.receiving_item_id
        join public.recieving h on h.id=i.docentry where a.breeder_line_id=v_source_id and h.void=1;
      if not p_historical then
        select case when default_expiration_months is not null then (v_mfg+make_interval(months=>default_expiration_months))::date end into v_exp from public.items where item_code=v_item;
        v_batch:=public.receiving_new_batch('hatchery',v_receipt,'PLACEMENT:'||v_placement,v_item,v_mfg,v_exp);
      end if;
    else
      select h.id into v_parent from public.dispatch_doc_item l join public.dispatch_doc h on h.id=l.dispatch_doc_id where l.id=v_source_id for update of h;
      select l.qty,l.doc_batch_code,h.dr_no into v_available,v_ref,v_doc from public.dispatch_doc_item l join public.dispatch_doc h on h.id=l.dispatch_doc_id
        where l.id=v_source_id and h.status='Posted' and h.is_active and h.destination_farm_id=v_farm and l.classification='SALEABLE' and nullif(btrim(l.doc_batch_code),'') is not null;
      if not found then raise exception 'DOC source must be a posted saleable DOC dispatch to this farm'; end if;
      select coalesce(sum(a.quantity),0) into v_consumed from public.receiving_source_links a join public.goods_receipt_doc d on d.id=a.doc_detail_id
        join public.goods_receipt h on h.id=d.goods_reciept_id where a.doc_dispatch_line_id=v_source_id and d.void='1'
        and (h.status in ('Posted','Received') or h.id=v_receipt);
    end if;
    if v_consumed+v_qty>v_available then raise exception 'Source % has only % remaining; requested %',v_doc,v_available-v_consumed,v_qty; end if;
    insert into public.receiving_source_links(receiving_item_id,doc_detail_id,breeder_line_id,doc_dispatch_line_id,placement_id,placement_date,source_reference,document_no,farm_id,quantity,shortage,doa,rejects,receiving_batch,historical,created_by)
      values(case when p_kind='hatchery' then p_line_id end,case when p_kind='broiler' then p_line_id end,case when p_kind='hatchery' then v_source_id end,case when p_kind='broiler' then v_source_id end,v_placement,v_date,v_ref,v_doc,v_farm,v_qty,v_short,v_bad,v_rej,v_batch,p_historical,auth.uid());
    v_sum:=v_sum+v_qty; v_actual_sum:=v_actual_sum+v_qty-v_short-v_bad-v_rej; v_doa_sum:=v_doa_sum+v_bad; v_reject_sum:=v_reject_sum+v_rej;
    v_canonical:=v_canonical||jsonb_build_array(jsonb_build_object('sourceLineId',v_source_id,'quantity',v_qty,'shortage',v_short,'doa',v_bad,'rejects',v_rej,'sourceReference',v_ref,'documentNo',v_doc,'receivingBatch',v_batch));
  end loop;
  if jsonb_array_length(p_allocations)>0 and (v_sum is distinct from v_expected or v_actual_sum is distinct from v_actual or v_doa_sum<>v_doa or v_reject_sum<>v_rejects) then
    raise exception 'Source allocations must exactly match this receiving line and its actual/short/DOA/reject counts';
  end if;
  if p_kind='hatchery' then update public.recieving_items set source_allocations=v_canonical where id=p_line_id;
  else update public.goods_receipt_doc set source_allocations=v_canonical where id=p_line_id; end if;
end $$;

create or replace function public.link_receiving_source(p_kind text,p_line_id bigint,p_allocations jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if jsonb_array_length(p_allocations)=0 then raise exception 'Select at least one verified source'; end if;
  perform public.set_receiving_source_links(p_kind,p_line_id,p_allocations,true);
end $$;

-- Source documents cannot change underneath existing receiving allocations.
create or replace function public.guard_received_dispatch_source()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_linked boolean;
begin
  if tg_table_name='tbl_brd_dispatch' then
    select exists(select 1 from public.receiving_source_links a join public.tbl_brd_dispatch_line l on l.id=a.breeder_line_id
      join public.recieving_items i on i.id=a.receiving_item_id join public.recieving r on r.id=i.docentry where l.dispatch_id=old.id and r.void=1) into v_linked;
  elsif tg_table_name='dispatch_doc' then
    select exists(select 1 from public.receiving_source_links a join public.dispatch_doc_item l on l.id=a.doc_dispatch_line_id
      join public.goods_receipt_doc d on d.id=a.doc_detail_id join public.goods_receipt r on r.id=d.goods_reciept_id where l.dispatch_doc_id=old.id and d.void='1' and r.status<>'Cancelled') into v_linked;
  elsif tg_table_name='tbl_brd_dispatch_line' then
    perform 1 from public.tbl_brd_dispatch where id=old.dispatch_id for update;
    select exists(select 1 from public.receiving_source_links where breeder_line_id=old.id) into v_linked;
  else
    perform 1 from public.dispatch_doc where id=old.dispatch_doc_id for update;
    select exists(select 1 from public.receiving_source_links where doc_dispatch_line_id=old.id) into v_linked;
  end if;
  if v_linked and (tg_op='DELETE' or (to_jsonb(new)-array['updated_at','updated_by']) is distinct from (to_jsonb(old)-array['updated_at','updated_by'])) then
    raise exception 'This dispatch has linked receivings. Resolve the receiving allocations before changing or reversing its source';
  end if;
  if tg_op='DELETE' then return old; end if; return new;
end $$;
drop trigger if exists guard_received_source on public.tbl_brd_dispatch;
create trigger guard_received_source before update or delete on public.tbl_brd_dispatch for each row execute function public.guard_received_dispatch_source();
drop trigger if exists guard_received_source on public.tbl_brd_dispatch_line;
create trigger guard_received_source before update or delete on public.tbl_brd_dispatch_line for each row execute function public.guard_received_dispatch_source();
drop trigger if exists guard_received_source on public.dispatch_doc;
create trigger guard_received_source before update or delete on public.dispatch_doc for each row execute function public.guard_received_dispatch_source();
drop trigger if exists guard_received_source on public.dispatch_doc_item;
create trigger guard_received_source before update or delete on public.dispatch_doc_item for each row execute function public.guard_received_dispatch_source();

-- Validate all draft allocations again under source locks at the final post transition.
create or replace function public.validate_doc_receiving_sources_on_post()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_detail record; a record; v_qty numeric; v_used numeric;
begin
  if new.status not in ('Posted','Received') or old.status in ('Posted','Received') then return new; end if;
  perform h.id from public.dispatch_doc h where h.id in (
    select l.dispatch_doc_id from public.dispatch_doc_item l join public.receiving_source_links s on s.doc_dispatch_line_id=l.id
    join public.goods_receipt_doc gd on gd.id=s.doc_detail_id where gd.goods_reciept_id=new.id and gd.void='1'
  ) order by h.id for update;
  for a in select distinct s.doc_dispatch_line_id from public.receiving_source_links s join public.goods_receipt_doc d on d.id=s.doc_detail_id where d.goods_reciept_id=new.id and d.void='1' order by s.doc_dispatch_line_id loop
    perform 1 from public.dispatch_doc h join public.dispatch_doc_item l on l.dispatch_doc_id=h.id where l.id=a.doc_dispatch_line_id for update of h;
    select l.qty into v_qty from public.dispatch_doc_item l join public.dispatch_doc h on h.id=l.dispatch_doc_id where l.id=a.doc_dispatch_line_id and h.status='Posted' and h.is_active and h.destination_farm_id=new.farm_id;
    if not found then raise exception 'Source dispatch is no longer available for this farm'; end if;
    select sum(s.quantity) into v_used from public.receiving_source_links s join public.goods_receipt_doc d on d.id=s.doc_detail_id join public.goods_receipt r on r.id=d.goods_reciept_id
      where s.doc_dispatch_line_id=a.doc_dispatch_line_id and d.void='1' and (r.status in ('Posted','Received') or r.id=new.id);
    if v_used>v_qty then raise exception 'Source dispatch was received elsewhere; refresh its remaining quantity'; end if;
  end loop;
  for v_detail in select * from public.goods_receipt_doc where goods_reciept_id=new.id and void='1' and (jsonb_array_length(source_allocations)>0 or id in(select doc_detail_id from public.receiving_source_links)) loop
    if not exists(select 1 from public.receiving_source_links where doc_detail_id=v_detail.id) then raise exception 'Source allocations must be saved before posting'; end if;
    if (select sum(quantity) from public.receiving_source_links where doc_detail_id=v_detail.id)<>v_detail.quantity_received
      or (select sum(quantity-shortage-doa-rejects) from public.receiving_source_links where doc_detail_id=v_detail.id)<>v_detail.actual_received
      or (select sum(doa) from public.receiving_source_links where doc_detail_id=v_detail.id)<>v_detail.doa_quantity
      or (select sum(rejects) from public.receiving_source_links where doc_detail_id=v_detail.id)<>v_detail.reject_count
      then raise exception 'Receiving quantities do not match source allocations'; end if;
  end loop;
  return new;
end $$;
drop trigger if exists validate_doc_receiving_sources on public.goods_receipt;
create trigger validate_doc_receiving_sources before update of status on public.goods_receipt for each row execute function public.validate_doc_receiving_sources_on_post();

-- The legacy manual receiving path posts on line insertion. Keep that timing,
-- but use the allocated batches for copied lines and preserve classification ref.
create or replace function public.dmf_trg_post_inventory_from_recieving_items()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare a record;
begin
  if jsonb_array_length(new.source_allocations)>0 then
    perform public.set_receiving_source_links('hatchery',new.id,new.source_allocations,false);
    for a in select * from public.receiving_source_links where receiving_item_id=new.id loop
      if a.quantity-a.shortage>0 then
        insert into public.inventory_postings(source_doc_type,source_docentry,item_code,warehouse_code,bin_code,qty,created_by,ref_type,ref,transfer_type,ref_type2,ref2,batch_number)
        values('RECEIVING',new.docentry,new.sku,'MAIN','DEFAULT',a.quantity-a.shortage,auth.uid(),'breeder_reference',new.brdr_ref_no,'IN','BREEDER_PLACEMENT_DATE',a.source_reference,a.receiving_batch);
      end if;
    end loop;
  else
    insert into public.inventory_postings(source_doc_type,source_docentry,item_code,warehouse_code,bin_code,qty,created_by,ref_type,ref,transfer_type)
    values('RECEIVING',new.docentry,new.sku,'MAIN','DEFAULT',new.actual_count,auth.uid(),'breeder_reference',new.brdr_ref_no,'IN');
  end if;
  return new;
end $$;

create or replace function public.save_hatchery_receiving_with_sources(p_payload jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id bigint; v_farm bigint; v_hash text:=md5(p_payload::text); v_request public.receiving_save_requests%rowtype;
  v_result jsonb; v_approval jsonb; i jsonb;
begin
  v_farm:=(p_payload->>'delivered_to')::bigint;
  perform public.require_receiving_source_access('hatchery',v_farm,'insert');
  if p_request_id is null then raise exception 'A save request identity is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into v_request from public.receiving_save_requests where request_id=p_request_id;
  if found then
    if v_request.actor_id<>auth.uid() or v_request.kind<>'hatchery' then raise exception 'Save request ownership mismatch' using errcode='42501'; end if;
    if v_request.fingerprint<>v_hash then raise exception 'This receiving was already saved. Open the saved receiving before making another document'; end if;
    return v_request.result;
  end if;
  if jsonb_typeof(p_payload->'items') is distinct from 'array' or jsonb_array_length(p_payload->'items')=0 then raise exception 'Receiving items are required'; end if;
  if not exists(select 1 from public.farms where code=p_payload->>'soldTo' and upper(farm_type)='BE') then raise exception 'Select a canonical breeder source farm'; end if;
  perform h.id from public.tbl_brd_dispatch h where h.id in (
    select l.dispatch_id from public.tbl_brd_dispatch_line l where l.id in (
      select (a->>'sourceLineId')::bigint from jsonb_array_elements(p_payload->'items') x cross join lateral jsonb_array_elements(coalesce(x->'source_allocations','[]')) a
    )
  ) order by h.id for update;
  insert into public.recieving(doc_date,temperature,humidity,"soldTo","Attention",po_no,voyage_no,shipped_via,dr_num,no_of_crates,no_of_tray,plate_no,driver,serial_no,delivered_to,farm_id,brdr_ref_no)
    values((p_payload->>'doc_date')::date,p_payload->>'temperature',p_payload->>'humidity',p_payload->>'soldTo',p_payload->>'Attention',p_payload->>'po_no',p_payload->>'voyage_no',p_payload->>'shipped_via',p_payload->>'dr_num',p_payload->>'no_of_crates',p_payload->>'no_of_tray',p_payload->>'plate_no',p_payload->>'driver',p_payload->>'serial_no',v_farm,v_farm,p_payload->>'brdr_ref_no') returning id into v_id;
  update public.recieving set destination_farm_id=v_farm,origin_farm_id=(select id from public.farms where code=p_payload->>'soldTo' and upper(farm_type)='BE') where id=v_id;
  for i in select value from jsonb_array_elements(p_payload->'items') loop
    if nullif(btrim(i->>'sku'),'') is null or (i->>'actual_count')::numeric<0 then raise exception 'A receiving item and nonnegative actual count are required'; end if;
    insert into public.recieving_items(docentry,sku,"UoM",expected_count,actual_count,lot_no,prod_date,age,house_no,jr,he,brdr_ref_no,source_allocations)
      values(v_id,i->>'sku',i->>'UoM',coalesce((i->>'expected_count')::numeric,(i->>'total_api')::numeric,(i->>'actual_count')::numeric),(i->>'actual_count')::numeric,i->>'lot_no',i->>'prod_date',i->>'age',i->>'house_no',i->>'jr',i->>'he',i->>'brdr_ref_no',coalesce(i->'source_allocations','[]'));
  end loop;
  v_approval:=public.submit_for_approval(p_document_type=>'receiving',p_document_id=>v_id,p_document_no=>p_payload->>'dr_num',p_requested_by_auth_id=>auth.uid(),p_payload=>p_payload||jsonb_build_object('docentry',v_id),p_remarks=>'Receiving document submitted for approval.');
  v_result:=jsonb_build_object('docentry',v_id,'approval',v_approval);
  insert into public.receiving_save_requests values(p_request_id,auth.uid(),'hatchery',v_id,v_hash,v_result,now());
  return v_result;
end $$;

create or replace function public.save_doc_receiving_with_sources(p_payload jsonb,p_request_id uuid)
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id bigint; v_farm public.farms%rowtype; v_old public.goods_receipt%rowtype; v_request public.receiving_save_requests%rowtype;
  v_hash text:=md5(p_payload::text); v_doc_id bigint; v_line integer:=0; v_item_line integer:=0; d jsonb; i jsonb; v_batch text; v_ref text; v_source bigint; v_expected numeric;
  v_good bigint; v_bad bigint; v_reject bigint; v_target text:=p_payload->>'status';
begin
  v_id:=nullif(p_payload->>'id','')::bigint;
  perform public.require_receiving_source_access('broiler',(p_payload->>'farmId')::bigint,case when v_id is null then 'insert' else 'edit' end);
  if p_request_id is null then raise exception 'A save request identity is required'; end if;
  if v_target is null or v_target not in ('Draft','Posted') then raise exception 'Only Draft or Posted may be saved'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into v_request from public.receiving_save_requests where request_id=p_request_id for update;
  if found then
    if v_request.actor_id<>auth.uid() or v_request.kind<>'broiler' then raise exception 'Save request ownership mismatch' using errcode='42501'; end if;
    if v_request.fingerprint=v_hash then return v_request.receipt_id; end if;
    if v_id is distinct from v_request.receipt_id then raise exception 'This DOC Placement was already saved. Reload it before saving changes'; end if;
  end if;
  select * into v_farm from public.farms where id=(p_payload->>'farmId')::bigint;
  if v_id is not null then
    select * into v_old from public.goods_receipt where id=v_id for update;
    if not found or v_old.status<>'Draft' then raise exception 'Only an existing draft can be changed'; end if;
    perform public.require_receiving_source_access('broiler',v_old.farm_id,'edit');
    update public.goods_receipt set farm_id=v_farm.id,farm_code=v_farm.code,farm_name=v_farm.name,vendor=p_payload->>'vendor',receive_date=(p_payload->>'receiveDate')::date,
      remarks=p_payload->>'remarks',default_warehouse_id=(p_payload->>'defaultWarehouseId')::bigint,updated_by=auth.uid(),updated_at=now() where id=v_id;
  else
    insert into public.goods_receipt(gr_no,dr_reference,vendor,receive_date,fms_type,farm_id,farm_code,farm_name,default_warehouse_id,remarks,status,created_by)
      values(p_payload->>'grNo',p_payload->>'grNo',p_payload->>'vendor',(p_payload->>'receiveDate')::date,'broiler',v_farm.id,v_farm.code,v_farm.name,(p_payload->>'defaultWarehouseId')::bigint,p_payload->>'remarks','Draft',auth.uid()) returning id into v_id;
  end if;
  if (p_payload->>'receiveDate')::date>current_date then raise exception 'Receiving date cannot be in the future'; end if;
  if jsonb_typeof(p_payload->'docDetails') is distinct from 'array' or jsonb_array_length(p_payload->'docDetails')=0 then raise exception 'DOC details are required'; end if;
  perform h.id from public.dispatch_doc h where h.id in (
    select l.dispatch_doc_id from public.dispatch_doc_item l where l.id in (
      select (a->>'sourceLineId')::bigint from jsonb_array_elements(p_payload->'docDetails') x cross join lateral jsonb_array_elements(coalesce(x->'source_allocations','[]')) a
    )
  ) order by h.id for update;
  -- Draft replacement is contained in this transaction. Historical posted lines never enter this path.
  delete from public.receiving_source_links where doc_detail_id in(select id from public.goods_receipt_doc where goods_reciept_id=v_id);
  update public.goods_receipt_doc set void='0',line_no=-id,updated_by=auth.uid() where goods_reciept_id=v_id and void='1';
  update public.goods_receipt_items set void='0',line_no=-id,updated_by=auth.uid() where goods_reciept_id=v_id and void='1';
  for d in select value from jsonb_array_elements(p_payload->'docDetails') loop
    v_line:=v_line+1;
    if (d->>'receive_date')::date>current_date then raise exception 'Receiving date cannot be in the future'; end if;
    if nullif(btrim(d->>'doc_source'),'') is null then raise exception 'DOC Source is required'; end if;
    insert into public.goods_receipt_doc(goods_reciept_id,line_no,receive_date,receive_time,mnf_date,doc_source,building_warehouse_id,flock_card_id,transfer_slip,average_doc_weight,quantity_received,actual_received,short_count_remarks,doa_quantity,doa_count_remarks,reject_count,reject_count_remarks,void,created_by)
      values(v_id,v_line,(d->>'receive_date')::date,nullif(d->>'receive_time','')::time,(d->>'mnf_date')::date,d->>'doc_source',(d->>'building_warehouse_id')::bigint,(d->>'flock_card_id')::bigint,d->>'transfer_slip',coalesce((d->>'average_doc_weight')::numeric,0),(d->>'quantity_received')::numeric,(d->>'actual_received')::numeric,d->>'short_count_remarks',coalesce((d->>'doa_quantity')::numeric,0),d->>'doa_count_remarks',coalesce((d->>'reject_count')::numeric,0),d->>'reject_count_remarks','1',auth.uid()) returning id into v_doc_id;
    if jsonb_array_length(coalesce(d->'source_allocations','[]'))>0 then perform public.set_receiving_source_links('broiler',v_doc_id,d->'source_allocations',false); end if;
  end loop;
  for i in select value from jsonb_array_elements(p_payload->'lines') loop
    v_item_line:=v_item_line+1; v_source:=nullif(i->>'sourceDispatchLineId','')::bigint; v_ref:=null;
    if (i->>'baseQty')::numeric<0 or (i->>'altQty')::numeric<0 then raise exception 'Invalid receiving quantity'; end if;
    if nullif(i->>'batchRuleId','') is not null and not exists(select 1 from public.batch_rules where id=(i->>'batchRuleId')::bigint and (warehouse_id is null or warehouse_id=(i->>'warehouseId')::bigint)) then raise exception 'Batch rule does not match the receiving warehouse'; end if;
    if exists(select 1 from public.goods_receipt_doc d join public.receiving_source_links a on a.doc_detail_id=d.id where d.goods_reciept_id=v_id and d.line_no=(i->>'docLineNo')::integer and d.void='1') and v_source is null then
      raise exception 'Every item batch in a copied receiving line requires its source allocation';
    end if;
    if v_source is not null then
      select a.source_reference into v_ref from public.receiving_source_links a join public.goods_receipt_doc d on d.id=a.doc_detail_id
        where d.goods_reciept_id=v_id and d.line_no=(i->>'docLineNo')::integer and d.void='1' and a.doc_dispatch_line_id=v_source;
      if not found then raise exception 'Item line has no matching source allocation'; end if;
      v_batch:=public.receiving_new_batch('broiler',v_id,'DOC:'||v_source,i->>'itemCode',(i->>'manufacturingDate')::date,nullif(i->>'expiryDate','')::date,nullif(i->>'batchRuleId','')::bigint);
    else
      v_batch:=public.receiving_new_batch('broiler',v_id,'MANUAL:'||(i->>'docLineNo'),i->>'itemCode',(i->>'manufacturingDate')::date,nullif(i->>'expiryDate','')::date,nullif(i->>'batchRuleId','')::bigint);
    end if;
    insert into public.goods_receipt_items(goods_reciept_id,line_no,item_id,item_code,description,batch_rule_id,batch_number,supplier_batch_number,manufacturing_date,expiry_date,alt_qty,alt_uom,base_qty,base_uom,warehouse_id,warehouse_code,warehouse_name,returned_qty,doc_line_no,void,created_by,source_dispatch_line_id,source_ref2)
      select v_id,v_item_line,it.id,it.item_code,i->>'description',nullif(i->>'batchRuleId','')::bigint,v_batch,nullif(i->>'supplierBatchNumber',''),(i->>'manufacturingDate')::date,nullif(i->>'expiryDate','')::date,(i->>'altQty')::numeric,i->>'altUom',(i->>'baseQty')::numeric,i->>'baseUom',w.id,w.whse_code,w.whse_name,0,(i->>'docLineNo')::integer,'1',auth.uid(),v_source,v_ref
        from public.items it join public.i_warehouse w on w.id=(i->>'warehouseId')::bigint where it.id=(i->>'itemId')::bigint and it.item_code=i->>'itemCode' and it.void::text='1';
    if not found then raise exception 'Invalid receiving item or warehouse'; end if;
  end loop;
  -- Validate totals using persisted settings and allocations, not browser item descriptions.
  select good_doc,bad_doc,reject_doc into v_good,v_bad,v_reject from public.doc_rec_settings where farm_id=v_farm.id and void='1' limit 1;
  if v_good is null then raise exception 'DOC Placement farm settings are required'; end if;
  for d in select to_jsonb(x) from public.goods_receipt_doc x where goods_reciept_id=v_id and void='1' loop
    if exists(select 1 from public.goods_receipt_items where goods_reciept_id=v_id and doc_line_no=(d->>'line_no')::integer and void='1' and item_id not in (v_good,coalesce(v_bad,-1),coalesce(v_reject,-1))) then
      raise exception 'DOC item does not match the receiving farm settings';
    end if;
    if exists(select 1 from public.goods_receipt_items where goods_reciept_id=v_id and doc_line_no=(d->>'line_no')::integer and void='1' and
      ((item_id=v_good and warehouse_id is distinct from (d->>'building_warehouse_id')::bigint) or (item_id in(v_bad,v_reject) and warehouse_id=(d->>'building_warehouse_id')::bigint))) then
      raise exception 'Good DOC must use the building; DOA and rejects must use the disposal warehouse';
    end if;
    if v_target='Posted' then
      for v_item_line in 1..3 loop
        v_expected:=case v_item_line when 1 then (d->>'actual_received')::numeric when 2 then (d->>'doa_quantity')::numeric else (d->>'reject_count')::numeric end;
        if (select coalesce(sum(base_qty),0) from public.goods_receipt_items where goods_reciept_id=v_id and doc_line_no=(d->>'line_no')::integer and void='1'
          and item_id=case v_item_line when 1 then v_good when 2 then v_bad else v_reject end)<>v_expected then raise exception 'Posted item quantities must match the DOC receiving counts'; end if;
      end loop;
    end if;
    for v_source in select doc_dispatch_line_id from public.receiving_source_links where doc_detail_id=(d->>'id')::bigint loop
      for v_item_line in 1..3 loop
        select case v_item_line when 1 then quantity-shortage-doa-rejects when 2 then doa else rejects end into v_expected from public.receiving_source_links where doc_detail_id=(d->>'id')::bigint and doc_dispatch_line_id=v_source;
        if v_target='Posted' and (select coalesce(sum(base_qty),0) from public.goods_receipt_items where goods_reciept_id=v_id and doc_line_no=(d->>'line_no')::integer and void='1' and source_dispatch_line_id=v_source
          and item_id=case v_item_line when 1 then v_good when 2 then v_bad else v_reject end)<>v_expected then raise exception 'Item base quantities do not match source batch counts'; end if;
      end loop;
    end loop;
  end loop;
  if v_target='Posted' then update public.goods_receipt set status='Posted',updated_by=auth.uid() where id=v_id; end if;
  insert into public.receiving_save_requests values(p_request_id,auth.uid(),'broiler',v_id,v_hash,to_jsonb(v_id),now())
    on conflict(request_id) do update set fingerprint=excluded.fingerprint,receipt_id=excluded.receipt_id,result=excluded.result;
  return v_id;
end $$;

-- Add lineage only to the receipt IN posting. Consolidation and disposal ref2
-- meanings remain unchanged, and historical Link Source never touches postings.
create or replace function public.receiving_posting_source_reference()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_ref text;
begin
  if new.source_doc_type='GOODS_RECEIPT' and new.transfer_type='IN' then
    select min(source_ref2) into v_ref from public.goods_receipt_items where goods_reciept_id=new.source_docentry and item_code=new.item_code and batch_number=new.batch_number and void='1';
    if v_ref is not null then new.ref_type2:='HATCHERY_DOC_BATCH'; new.ref2:=v_ref; end if;
  end if;
  return new;
end $$;
drop trigger if exists receiving_posting_source_ref on public.inventory_postings;
create trigger receiving_posting_source_ref before insert on public.inventory_postings for each row execute function public.receiving_posting_source_reference();

-- Linked lines must be edited by the atomic save or Link Source RPC. This is
-- SECURITY INVOKER deliberately: a browser cannot impersonate the RPC owner.
create or replace function public.guard_receiving_source_line_write()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if current_user in ('authenticated','anon') and tg_table_name='goods_receipt_items' and tg_op<>'DELETE' then
    if exists(select 1 from public.goods_receipt_doc d where d.goods_reciept_id=(to_jsonb(new)->>'goods_reciept_id')::bigint
      and d.line_no=(to_jsonb(new)->>'doc_line_no')::integer and d.void='1' and d.source_allocations<>'[]'::jsonb) then
      raise exception 'Use the transactional receiving save to change linked item batches' using errcode='42501';
    end if;
  end if;
  if current_user in ('authenticated','anon') and (
    coalesce(to_jsonb(new)->'source_allocations','[]')<>'[]'::jsonb or coalesce(to_jsonb(old)->'source_allocations','[]')<>'[]'::jsonb
    or nullif(to_jsonb(new)->>'source_dispatch_line_id','') is not null or nullif(to_jsonb(old)->>'source_dispatch_line_id','') is not null
  ) then raise exception 'Use the transactional receiving save to change linked lines' using errcode='42501'; end if;
  if tg_op='DELETE' then return old; end if; return new;
end $$;
drop trigger if exists guard_receiving_source_write on public.recieving_items;
create trigger guard_receiving_source_write before insert or update or delete on public.recieving_items for each row execute function public.guard_receiving_source_line_write();
drop trigger if exists guard_receiving_source_write on public.goods_receipt_doc;
create trigger guard_receiving_source_write before insert or update or delete on public.goods_receipt_doc for each row execute function public.guard_receiving_source_line_write();
drop trigger if exists guard_receiving_source_write on public.goods_receipt_items;
create trigger guard_receiving_source_write before insert or update or delete on public.goods_receipt_items for each row execute function public.guard_receiving_source_line_write();

revoke all on function public.require_receiving_source_access(text,bigint,text),public.receiving_new_batch(text,bigint,text,text,date,date,bigint),public.set_receiving_source_links(text,bigint,jsonb,boolean),public.guard_received_dispatch_source(),public.validate_doc_receiving_sources_on_post(),public.receiving_posting_source_reference() from public,anon,authenticated;
revoke all on function public.list_receiving_sources(text,bigint,bigint),public.link_receiving_source(text,bigint,jsonb) from public,anon;
grant execute on function public.list_receiving_sources(text,bigint,bigint),public.link_receiving_source(text,bigint,jsonb) to authenticated;
revoke all on function public.save_hatchery_receiving_with_sources(jsonb,uuid),public.save_doc_receiving_with_sources(jsonb,uuid) from public,anon;
grant execute on function public.save_hatchery_receiving_with_sources(jsonb,uuid),public.save_doc_receiving_with_sources(jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
