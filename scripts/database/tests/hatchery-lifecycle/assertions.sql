\set ON_ERROR_STOP on
\ir fixture.sql

insert into auth.users(id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003');
insert into public.users(id,auth_id,email,firstname,lastname,isactive,user_type,fms_type) values
  (1,'00000000-0000-0000-0000-000000000001','viewer@example.test','External','Viewer','1',3,'Hatchery'),
  (2,'00000000-0000-0000-0000-000000000002','active@example.test','Active','TA','1',3,'Hatchery'),
  (3,'00000000-0000-0000-0000-000000000003','zero@example.test','Zero','TA','1',3,'Hatchery');
insert into public.farms(id,code,name,void,farm_type,approval_status,island,administrative_region)
values(10,'HA-10','Test Hatchery',1,'HA','approved','Luzon','Region III (Central Luzon)'),
      (20,'BR-20','Destination Farm',1,'BR','approved','Luzon','Region III (Central Luzon)');
insert into public.users_farms(users_id,farm_id,farm_code,void) values(1,10,'HA-10','1'),(2,10,'HA-10','1'),(3,10,'HA-10','1');
insert into public.user_permissions(user_id,ilink,is_visible) values('00000000-0000-0000-0000-000000000001','/report/hatchery-lifecycle/view',true);

insert into public.recieving(id,created_at,created_by,doc_date,dr_num,status,brdr_ref_no,void,farm_id)
values(100,'2026-10-05 08:00+08','00000000-0000-0000-0000-000000000002','2026-10-04','HA-RCV-100','approved','HEADER-REF-DOES-NOT-MATCH',1,10);
insert into public.recieving_items(docentry,brdr_ref_no,"UoM",actual_count) values(100,'BE-REF-1','EGG',100);
insert into public.hatch_classification(id,br_no,classi_ref_no,farm_id,good_egg) values(101,'BE-REF-1','CL1001',10,95);
insert into public.egg_storage_mngt(id,classi_ref_no) values(102,'CL1001');
insert into public.egg_pre_warming(id,egg_ref_no) values(103,'CL1001');
insert into public.setter_incubation_process(id,ref_no,qty_set_egg) values(104,'CL1001',94);
insert into public.egg_transfer_process(id,ref_no,total_egg_transfer) values(105,'CL1001',93);
insert into public.egg_hatchery_process(id,egg_ref,total_egg) values(106,'CL1001',93);
insert into public.chick_pullout_process(id,egg_ref_no,chick_hatch_ref_no,chicks_hatched) values(107,'CL1001','PO-1',90);
insert into public.chick_grading_process(id,egg_ref_no,batch_code,class_a,cull_chicks) values(108,'CL1001','DOC-BATCH-1',85,4);
insert into public.dispatch_doc(id,doc_date,dr_no,farm_name,destination_farm_id,destination_farm_code,status)
values(109,'2026-10-05','DR-1','Destination Farm',20,'BR-20','Posted');
insert into public.dispatch_doc_item(id,dispatch_doc_id,doc_batch_code,sku_name,classification,uom,qty)
values(110,109,'DOC-BATCH-1','Class A','SALEABLE','PCS',85);
insert into public.disposal(id,farm_id,batch_code) values(111,10,'DOC-BATCH-1');
insert into public.disposal_item(id,disposal_id,sku,uom,qty) values(112,111,'Cull','PCS',4);

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

do $$
declare result jsonb;
begin
  result := public.get_hatchery_lifecycle_report(array[10]::bigint[], null, '2026-10-01', '2026-10-31', 'created', array['approved'], 1, 25);
  if jsonb_array_length(result->'rows') <> 3 then raise exception 'Expected all three assigned user rows, including zero activity rows.'; end if;
  if (result#>>'{pagination,total}')::integer <> 1 then raise exception 'Expected one Receiving lifecycle.'; end if;
  if (result->>'apiVersion')::integer <> 3 then raise exception 'Expected full-record lifecycle API version 3.'; end if;
  if jsonb_array_length(result->'lifecycles'->0->'nodes') <> 11 then raise exception 'Expected all Receiving-to-Disposal stage nodes.'; end if;
  if jsonb_array_length(result->'lifecycles'->0->'edges') <> 10 then raise exception 'Expected one father-child edge for every non-root lifecycle node.'; end if;
  if not exists (
    select 1
    from jsonb_array_elements(result->'lifecycles'->0->'nodes') node
    where node->>'stage' = 'Receiving'
      and node#>'{metadata,header}' = (select to_jsonb(receiving) from public.recieving receiving where receiving.id = 100)
      and node#>'{metadata,items}' = (
        select jsonb_agg(to_jsonb(item) order by item.id)
        from public.recieving_items item
        where item.docentry = 100
      )
  ) then raise exception 'Receiving must return its complete header and all item rows.'; end if;
  if exists (
    select 1
    from (
      select 'Classification'::text as stage, to_jsonb(record) as expected from public.hatch_classification record where id = 101
      union all select 'Storage', to_jsonb(record) from public.egg_storage_mngt record where id = 102
      union all select 'Pre-Warming', to_jsonb(record) from public.egg_pre_warming record where id = 103
      union all select 'Setter', to_jsonb(record) from public.setter_incubation_process record where id = 104
      union all select 'Transfer', to_jsonb(record) from public.egg_transfer_process record where id = 105
      union all select 'Hatcher', to_jsonb(record) from public.egg_hatchery_process record where id = 106
      union all select 'Pullout', to_jsonb(record) from public.chick_pullout_process record where id = 107
      union all select 'Chick Grading', to_jsonb(record) from public.chick_grading_process record where id = 108
    ) expected
    where not exists (
      select 1
      from jsonb_array_elements(result->'lifecycles'->0->'nodes') node
      where node->>'stage' = expected.stage
        and node#>'{metadata,record}' = expected.expected
    )
  ) then raise exception 'Every Hatchery process node must return its complete source-table row.'; end if;
  if not exists (
    select 1
    from jsonb_array_elements(result->'lifecycles'->0->'nodes') node
    where node->>'stage' = 'Dispatch'
      and node#>'{metadata,header}' = (select to_jsonb(dispatch) from public.dispatch_doc dispatch where dispatch.id = 109)
      and node#>'{metadata,item}' = (select to_jsonb(item) from public.dispatch_doc_item item where item.id = 110)
  ) then raise exception 'DOC Dispatch must return its complete header and item row.'; end if;
  if not exists (
    select 1
    from jsonb_array_elements(result->'lifecycles'->0->'nodes') node
    where node->>'stage' = 'Disposal'
      and node#>'{metadata,header}' = (select to_jsonb(disposal) from public.disposal disposal where disposal.id = 111)
      and node#>'{metadata,item}' = (select to_jsonb(item) from public.disposal_item item where item.id = 112)
  ) then raise exception 'Disposal must return its complete header and item row.'; end if;
  if result#>>'{lifecycles,0,reference}' <> 'BE-REF-1' then raise exception 'Lifecycle must use the Receiving line breeder reference.'; end if;
  if result->'lifecycles'->0->'needs_review' <> '[]'::jsonb then raise exception 'Complete lifecycle should not require review.'; end if;
  if not exists (
    select 1 from jsonb_array_elements(result->'rows') row_data
    where row_data->>'ta_name' = 'Zero TA' and coalesce((row_data#>>'{stages,Receiving,documentCount}')::integer, 0) = 0
  ) then raise exception 'Zero-activity TA row is missing.'; end if;
  if result->'lifecycles'->0->'nodes' @> '[{"stage":"Dispatch","destinationFarmName":"Destination Farm"}]'::jsonb is not true then
    raise exception 'Dispatch destination farm is missing.';
  end if;
  if result->'lifecycles'->0->'nodes' @> '[{"stage":"Chick Grading","quantity":89}]'::jsonb is not true then
    raise exception 'Chick Grading quantity must sum the persisted classification fields.';
  end if;
  if result->'lifecycles'->0->'edges' @> '[{"fatherNodeKey":"CHICK_GRADING:108","childNodeKey":"DISPATCH:109:110"},{"fatherNodeKey":"CHICK_GRADING:108","childNodeKey":"DISPOSAL:111:112"}]'::jsonb is not true then
    raise exception 'One Chick Grading father must link independently to its Dispatch and Disposal children.';
  end if;
end;
$$;

do $$
declare result jsonb;
begin
  result := public.get_hatchery_lifecycle_report(array[10]::bigint[], null, '2026-10-05', '2026-10-05', 'receiving', array['approved'], 1, 25);
  if (result#>>'{pagination,total}')::integer <> 0 then raise exception 'Receiving Date must use recieving.doc_date rather than created_at.'; end if;
end;
$$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$
begin
  perform public.get_hatchery_lifecycle_report(array[10]::bigint[], null, '2026-10-01', '2026-10-31', 'created', array['approved'], 1, 25);
  raise exception 'A user without the report View permission was allowed.';
exception when insufficient_privilege then
  null;
end;
$$;

select 'hatchery lifecycle report assertions passed' as result;
