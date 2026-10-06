-- Keep source draft saves atomic so line replacement cannot emit a successful
-- Edit notification or leave a changed dispatch when a later insert fails.
begin;
create or replace function public.save_breeder_dispatch_transaction(p_id bigint,p_payload jsonb,p_post boolean default false)
returns bigint language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_id bigint:=p_id; f public.farms%rowtype; dest public.farms%rowtype; i jsonb; n integer:=0;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into f from public.farms where id=(p_payload->>'farm_id')::bigint and upper(farm_type)='BE';
  if not found then raise exception 'Canonical breeder farm is required'; end if;
  if (p_payload->>'farm_destination_id')::bigint is not null then
    select * into dest from public.farms where id=(p_payload->>'farm_destination_id')::bigint and upper(farm_type)='HA' and void::text='1' and approval_status='approved';
    if not found then raise exception 'Active hatchery destination is required'; end if;
  elsif p_payload->>'destination' not like 'Walk-in Customer - %' then raise exception 'Hatchery destination is required'; end if;
  if jsonb_typeof(p_payload->'lines') is distinct from 'array' or jsonb_array_length(p_payload->'lines')=0 then raise exception 'Dispatch lines are required'; end if;
  if v_id is null then
    insert into public.tbl_brd_dispatch(document_no,dispatch_date,farm_id,farm_code,farm_name,destination,farm_destination_id,hauler_name,plate_number,truck_seal,remarks,status,created_by)
    values(p_payload->>'document_no',(p_payload->>'dispatch_date')::date,f.id,f.code,f.name,coalesce(dest.name,p_payload->>'destination'),dest.id,p_payload->>'hauler_name',p_payload->>'plate_number',p_payload->>'truck_seal',p_payload->>'remarks','Draft',auth.uid()) returning id into v_id;
  else
    update public.tbl_brd_dispatch set dispatch_date=(p_payload->>'dispatch_date')::date,farm_id=f.id,farm_code=f.code,farm_name=f.name,destination=coalesce(dest.name,p_payload->>'destination'),farm_destination_id=dest.id,
      hauler_name=p_payload->>'hauler_name',plate_number=p_payload->>'plate_number',truck_seal=p_payload->>'truck_seal',remarks=p_payload->>'remarks',updated_by=auth.uid()
      where id=v_id and status='Draft';
    if not found then raise exception 'Only an accessible draft dispatch can be edited'; end if;
  end if;
  delete from public.tbl_brd_dispatch_line where dispatch_id=v_id;
  for i in select value from jsonb_array_elements(p_payload->'lines') loop
    n:=n+1;
    insert into public.tbl_brd_dispatch_line(dispatch_id,line_no,source_type,source_record_id,source_date,category,category_label,placement_id,placement_date,building_id,building_name,pen_id,pen_name,dr_no,source_available,dispatch_qty,remarks,created_by)
      values(v_id,n,i->>'source_type',(i->>'source_record_id')::bigint,(i->>'source_date')::date,i->>'category',i->>'category_label',(i->>'placement_id')::bigint,(i->>'placement_date')::date,(i->>'building_id')::bigint,i->>'building_name',(i->>'pen_id')::bigint,i->>'pen_name',i->>'dr_no',(i->>'source_available')::bigint,(i->>'dispatch_qty')::bigint,i->>'remarks',auth.uid());
  end loop;
  if p_post then update public.tbl_brd_dispatch set status='Posted',updated_by=auth.uid() where id=v_id; end if;
  return v_id;
end $$;
revoke all on function public.save_breeder_dispatch_transaction(bigint,jsonb,boolean) from public,anon;
grant execute on function public.save_breeder_dispatch_transaction(bigint,jsonb,boolean) to authenticated;

-- Service-only endpoint; the existing API verifies the actor's module permission.
create or replace function public.save_hatchery_dispatch_transaction(p_id bigint,p_payload jsonb,p_actor uuid)
returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id bigint:=p_id; f public.farms%rowtype; i jsonb;
begin
  if not exists(select 1 from public.users where auth_id=p_actor and isactive::text='1') then raise exception 'Active actor required'; end if;
  select * into f from public.farms where code=p_payload->>'destination_farm_code' and upper(farm_type)='BR' and void::text='1' and approval_status='approved';
  if not found then raise exception 'Active Broiler destination is required'; end if;
  if jsonb_typeof(p_payload->'items') is distinct from 'array' or jsonb_array_length(p_payload->'items')=0 then raise exception 'At least one DOC Dispatch item is required'; end if;
  if v_id is null then
    insert into public.dispatch_doc(doc_date,dr_no,farm_name,destination_farm_id,destination_farm_code,address,hauler_name,hauler_plate_no,truck_seal_no,chick_van_temp_c,number_of_fans,remarks,status,is_active,created_by)
      values((p_payload->>'doc_date')::date,p_payload->>'dr_no',f.name,f.id,f.code,f.address,p_payload->>'hauler_name',p_payload->>'hauler_plate_no',p_payload->>'truck_seal_no',(p_payload->>'chick_van_temp_c')::numeric,(p_payload->>'number_of_fans')::integer,p_payload->>'remarks','Draft',true,p_actor) returning id into v_id;
  else
    update public.dispatch_doc set doc_date=(p_payload->>'doc_date')::date,dr_no=p_payload->>'dr_no',farm_name=f.name,destination_farm_id=f.id,destination_farm_code=f.code,address=f.address,
      hauler_name=p_payload->>'hauler_name',hauler_plate_no=p_payload->>'hauler_plate_no',truck_seal_no=p_payload->>'truck_seal_no',chick_van_temp_c=(p_payload->>'chick_van_temp_c')::numeric,
      number_of_fans=(p_payload->>'number_of_fans')::integer,remarks=p_payload->>'remarks',updated_at=now(),updated_by=p_actor where id=v_id and status='Draft' and is_active;
    if not found then raise exception 'Only an active draft DOC Dispatch can be updated'; end if;
  end if;
  delete from public.dispatch_doc_item where dispatch_doc_id=v_id;
  for i in select value from jsonb_array_elements(p_payload->'items') loop
    insert into public.dispatch_doc_item(dispatch_doc_id,doc_batch_code,sku_name,classification,uom,qty,created_by)
      values(v_id,i->>'doc_batch_code',i->>'sku_name',(i->>'classification')::public.sku_classification,(i->>'uom')::public.uom_type,(i->>'qty')::numeric,p_actor);
  end loop;
  return v_id;
end $$;
revoke all on function public.save_hatchery_dispatch_transaction(bigint,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.save_hatchery_dispatch_transaction(bigint,jsonb,uuid) to service_role;
notify pgrst,'reload schema';
commit;
