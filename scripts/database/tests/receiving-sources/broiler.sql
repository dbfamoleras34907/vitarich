\set ON_ERROR_STOP on
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
insert into public.flock_card(id,card_no,farm_id,building_whse_id,cycle_no,start_date) values(1,'FC-TEST',3,1,'1','2026-09-01');
insert into public.doc_rec_settings(farm_id,good_doc,bad_doc,reject_doc) values(3,2,3,4);
insert into public.dispatch_doc(id,doc_date,dr_no,farm_name,destination_farm_id,status,is_active) values(1,'2026-09-01','HD-1','Broiler',3,'Posted',true);
insert into public.dispatch_doc_item(id,dispatch_doc_id,doc_batch_code,sku_name,classification,uom,qty)
 values(1,1,'HA-BATCH-1','Good DOC','SALEABLE','BOX',100),(2,1,'HA-BATCH-2','Good DOC','SALEABLE','PCS',100);
create function public.test_doc_payload(q numeric,doc text default 'DOC-1',stat text default 'Posted',source_id bigint default 1) returns jsonb language sql as $$
 select jsonb_build_object('grNo',doc,'vendor','Hatchery','receiveDate','2026-09-01','farmId',3,'defaultWarehouseId',1,'status',stat,
 'docDetails',jsonb_build_array(jsonb_build_object('receive_date','2026-09-01','mnf_date','2026-09-01','doc_source','Hatchery','building_warehouse_id',1,'flock_card_id',1,'transfer_slip','HD-1','quantity_received',q,'actual_received',q,
 'source_allocations',jsonb_build_array(jsonb_build_object('sourceLineId',source_id,'quantity',q,'shortage',0,'doa',0,'rejects',0)))),
 'lines',jsonb_build_array(jsonb_build_object('itemId',2,'itemCode','DOC-TEST','batchRuleId',2,'manufacturingDate','2026-09-01','expiryDate','','altQty',q,'altUom','PCS','baseQty',q,'baseUom','PCS','warehouseId',1,'docLineNo',1,'sourceDispatchLineId',source_id))) $$;
set role authenticated;
select public.save_doc_receiving_with_sources(public.test_doc_payload(30),'00000000-0000-0000-0000-000000000201');
reset role;
do $$ declare n integer; v_id bigint; p jsonb; begin
  select count(*) into n from public.inventory_postings;
  v_id:=public.save_doc_receiving_with_sources(public.test_doc_payload(30),'00000000-0000-0000-0000-000000000201');
  if (select count(*) from public.inventory_postings)<>n then raise exception 'Broiler retry duplicated inventory'; end if;
  if not exists(select 1 from public.inventory_postings where source_doc_type='GOODS_RECEIPT' and source_docentry=v_id and qty=30 and ref2='HA-BATCH-1') then raise exception 'DOC batch ref2 or base quantity missing'; end if;
  if not exists(select 1 from public.inventory_postings where source_doc_type='DOC_RECEIVING_CONSOLIDATION' and source_docentry=v_id and transfer_type='IN' and qty=30 and batch_number='DOC:F3:B1:1') then raise exception 'Broiler cycle consolidation changed'; end if;
  begin perform public.save_doc_receiving_with_sources(public.test_doc_payload(71,'DOC-OVER'),'00000000-0000-0000-0000-000000000202'); raise exception 'Broiler excess accepted'; exception when others then if sqlerrm='Broiler excess accepted' then raise; end if; end;
  if exists(select 1 from public.goods_receipt where gr_no='DOC-OVER') then raise exception 'Failed broiler save left a header'; end if;
  p:=public.test_doc_payload(20,'DOC-TAMPER'); p:=jsonb_set(p,'{lines,0,baseQty}','2000');
  begin perform public.save_doc_receiving_with_sources(p,'00000000-0000-0000-0000-000000000203'); raise exception 'Tampered base quantity accepted'; exception when others then if sqlerrm='Tampered base quantity accepted' then raise; end if; end;
  -- Two source batches under one receiving detail / item, preserved through consolidation.
  p:=public.test_doc_payload(20,'DOC-MULTI');
  p:=jsonb_set(p,'{docDetails,0,quantity_received}','40'); p:=jsonb_set(p,'{docDetails,0,actual_received}','40');
  p:=jsonb_set(p,'{docDetails,0,source_allocations}',(p#>'{docDetails,0,source_allocations}')||jsonb_build_array(jsonb_build_object('sourceLineId',2,'quantity',20,'shortage',0,'doa',0,'rejects',0)));
  p:=jsonb_set(p,'{lines}',(p->'lines')||jsonb_build_array(jsonb_set(p#>'{lines,0}','{sourceDispatchLineId}','2')));
  v_id:=public.save_doc_receiving_with_sources(p,'00000000-0000-0000-0000-000000000204');
  if (select count(*) from public.goods_receipt_doc where goods_reciept_id=v_id and void='1')<>1 or (select count(distinct batch_number) from public.goods_receipt_items where goods_reciept_id=v_id and void='1')<>2 then raise exception 'Multiple batches did not remain under one receiving line'; end if;
end $$;
do $$ declare d1 bigint; d2 bigint; begin
  d1:=public.save_doc_receiving_with_sources(public.test_doc_payload(40,'DRAFT-A','Draft'),'00000000-0000-0000-0000-000000000205');
  d2:=public.save_doc_receiving_with_sources(public.test_doc_payload(40,'DRAFT-B','Draft'),'00000000-0000-0000-0000-000000000206');
  update public.goods_receipt set status='Posted' where id=d1;
  begin update public.goods_receipt set status='Posted' where id=d2; raise exception 'Stale draft over-allocation accepted'; exception when others then if sqlerrm='Stale draft over-allocation accepted' then raise; end if; end;
end $$;
do $$ begin
 if exists(select 1 from public.notification_outbox where document_no in('DOC-OVER','DOC-TAMPER')) then raise exception 'Failed save emitted notification'; end if;
 if (select count(*) from public.notification_outbox where document_no='DOC-1' and event_key='DOC_RECEIVING_POSTED')<>1 then raise exception 'DOC Post event missing or duplicated'; end if;
end $$;
select public.process_notification_outbox();
do $$ begin if exists(select 1 from public.user_notifications) then raise exception 'No-rule DOC dispatch delivered notifications'; end if; end $$;
select 'Broiler source assertions passed' as result;
