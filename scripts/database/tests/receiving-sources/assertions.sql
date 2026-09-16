\set ON_ERROR_STOP on
create trigger dmf_trg_after_recieving_items_insert after insert on public.recieving_items for each row execute function public.dmf_trg_post_inventory_from_recieving_items();
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
insert into auth.users values('00000000-0000-0000-0000-000000000001');
insert into public.users(id,auth_id,email,isactive,user_type,fms_type) values(1,auth.uid(),'source-test@example.invalid','1',1,'Hatchery');
insert into public.farms(id,code,name,farm_type) values(1,'BE-TEST','Breeder','BE'),(2,'HA-TEST','Hatchery','HA'),(3,'BR-TEST','Broiler','BR'),(4,'OTHER-HA','Other hatchery','HA');
insert into public.items(id,item_code,item_name,item_group,unit_measure,inventory_uom) values(1,'EGG-TEST','Eggs','EGG','PCS','PCS'),(2,'DOC-TEST','Good DOC','DOC','PCS','PCS'),(3,'DOA-TEST','DOA','DOC','PCS','PCS'),(4,'REJECT-TEST','Reject','DOC','PCS','PCS');
insert into public.i_warehouse(id,whse_code,whse_name) values(1,'MAIN','Main');
insert into public.batch_number_series(id,code,name,prefix,next_number,number_length,date_format,include_expiry_date) values(1,'TEST','Test','T',1,3,'YYMMDD',false);
insert into public.batch_rules(id,code,name,series_id,item_id) values(1,'EGG','Egg',1,1),(2,'DOC','DOC',1,2),(3,'DOA','DOA',1,3),(4,'REJECT','Reject',1,4);
insert into public.tbl_placement(id,placement_date,dr_no,farm_id,building_id,pen_id,farm_name,building_no,pen_no) values(1,'2026-01-01','PL-1',1,1,1,'Breeder','B1','P1'),(2,'2026-01-01','PL-2',1,2,1,'Breeder','B2','P1');
insert into public.tbl_brd_dispatch(id,document_no,dispatch_date,farm_id,farm_code,farm_name,destination,farm_destination_id,status)
 values(1,'BD-1','2026-09-01',1,'BE-TEST','Breeder','Hatchery',2,'Posted'),(2,'BD-2','2026-09-01',1,'BE-TEST','Breeder','Other hatchery',4,'Posted');
insert into public.tbl_brd_dispatch_line(id,dispatch_id,line_no,placement_id,building_name,source_type,source_record_id,source_date,category,category_label,source_available,dispatch_qty)
 values(1,1,1,1,'B1','Egg Laying',1,'2026-09-01','hatching_egg','Hatching eggs',100,100),(2,1,2,2,'B2','Egg Laying',2,'2026-09-01','hatching_egg','Hatching eggs',100,100),(3,2,1,1,'B1','Egg Laying',1,'2026-09-01','hatching_egg','Hatching eggs',100,100);

create function public.test_receiving_payload(q numeric,source_id bigint default 1,doc text default 'RECEIVE-1') returns jsonb language sql as $$
select jsonb_build_object('doc_date','2026-09-01','soldTo','BE-TEST','delivered_to',2,'dr_num',doc,'brdr_ref_no',doc,
 'items',jsonb_build_array(jsonb_build_object('sku','EGG-TEST','UoM','PCS','prod_date','2026-09-01','brdr_ref_no',doc,'expected_count',q,'actual_count',q,
 'source_allocations',jsonb_build_array(jsonb_build_object('sourceLineId',source_id,'quantity',q,'shortage',0,'doa',0,'rejects',0))))) $$;

set role authenticated;
select public.save_hatchery_receiving_with_sources(public.test_receiving_payload(40),'00000000-0000-0000-0000-000000000101');
reset role;
do $$ declare n integer; b text; begin
  if (public.list_receiving_sources('hatchery',2)->0->>'placementId') is null then raise exception 'Missing placement identity'; end if;
  select count(*) into n from public.recieving;
  perform public.save_hatchery_receiving_with_sources(public.test_receiving_payload(40),'00000000-0000-0000-0000-000000000101');
  if (select count(*) from public.recieving)<>n then raise exception 'Retry duplicated receiving'; end if;
  if not exists(select 1 from public.inventory_postings where source_doc_type='RECEIVING' and qty=40 and ref2='2026-01-01' and batch_number is not null) then raise exception 'Missing base quantity/batch/placement ref2 posting'; end if;
  begin perform public.save_hatchery_receiving_with_sources(public.test_receiving_payload(61),'00000000-0000-0000-0000-000000000102'); raise exception 'Over-allocation accepted'; exception when others then if sqlerrm='Over-allocation accepted' then raise; end if; end;
  begin perform public.save_hatchery_receiving_with_sources(public.test_receiving_payload(1,3),'00000000-0000-0000-0000-000000000103'); raise exception 'Wrong farm accepted'; exception when others then if sqlerrm='Wrong farm accepted' then raise; end if; end;
  begin perform public.save_hatchery_receiving_with_sources(public.test_receiving_payload(1,1,'FAIL_APPROVAL'),'00000000-0000-0000-0000-000000000104'); raise exception 'Failed approval accepted'; exception when others then if sqlerrm='Failed approval accepted' then raise; end if; end;
  if (select count(*) from public.recieving)<>n then raise exception 'Failed receiving did not roll back'; end if;
  select batch_number into b from public.inventory_postings where source_doc_type='RECEIVING' limit 1;
  perform public.save_hatchery_receiving_with_sources(public.test_receiving_payload(20,1,'RECEIVE-2'),'00000000-0000-0000-0000-000000000105');
  if (select count(distinct batch_number) from public.inventory_postings where source_doc_type='RECEIVING')<>2 then raise exception 'Separate receiving reused an old batch'; end if;
  begin update public.tbl_brd_dispatch set status='Draft' where id=1; raise exception 'Linked source reversal accepted'; exception when others then if sqlerrm='Linked source reversal accepted' then raise; end if; end;
end $$;

-- Historical linking must not change any existing posting or batch.
insert into public.recieving(id,dr_num,brdr_ref_no,delivered_to) values(100,'HIST','HIST',2);
insert into public.recieving_items(id,docentry,sku,"UoM",actual_count,brdr_ref_no,prod_date) values(100,100,'EGG-TEST','PCS',10,'HIST','2026-09-01');
create temporary table stock_before as select * from public.inventory_postings;
select public.link_receiving_source('hatchery',100,'[{"sourceLineId":1,"quantity":10,"shortage":0,"doa":0,"rejects":0}]');
select public.link_receiving_source('hatchery',100,'[{"sourceLineId":1,"quantity":10,"shortage":0,"doa":0,"rejects":0}]');
do $$ begin
  if exists((select * from public.inventory_postings except select * from stock_before) union all (select * from stock_before except select * from public.inventory_postings)) then raise exception 'Historical linking changed inventory'; end if;
  if not exists(select 1 from public.notification_outbox where module_key='HATCHERY_RECEIVING' and entity_id='100' and event_key='HATCHERY_RECEIVING_EDITED') then raise exception 'Historical link did not emit Edit'; end if;
  if exists(select 1 from public.notification_outbox where entity_type='recieving' and event_key='HATCHERY_RECEIVING_POSTED' group by entity_id having count(*)>1) then raise exception 'Duplicate Post notification'; end if;
end $$;

select public.process_notification_outbox();
do $$ begin if exists(select 1 from public.user_notifications) then raise exception 'No-rule dispatch created delivery'; end if; end $$;
select 'Receiving source assertions passed' as result;
