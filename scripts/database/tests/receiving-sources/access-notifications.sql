\set ON_ERROR_STOP on
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
insert into auth.users values('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003');
insert into public.users(id,auth_id,email,isactive,user_type,fms_type) values
 (2,'00000000-0000-0000-0000-000000000002','receiver@example.invalid','1',3,'Hatchery'),
 (3,'00000000-0000-0000-0000-000000000003','wrong-farm@example.invalid','1',3,'Hatchery');
insert into public.users_farms(users_id,farm_id,farm_code) values(2,2,'HA-TEST'),(3,4,'OTHER-HA');
insert into public.user_permissions(user_id,group_name,title,is_visible) values
 ('00000000-0000-0000-0000-000000000002','Hatchery Masters','Receiving/view',true),
 ('00000000-0000-0000-0000-000000000003','Hatchery Masters','Receiving/view',true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
set role authenticated;
do $$ begin
  perform public.list_receiving_sources('hatchery',2);
  begin perform public.list_receiving_sources('hatchery',4); raise exception 'Cross-farm source read allowed'; exception when insufficient_privilege then null; end;
  begin perform public.list_receiving_sources('broiler',3); raise exception 'Cross-FMS source read allowed'; exception when insufficient_privilege then null; end;
  begin perform public.save_hatchery_receiving_with_sources(public.test_receiving_payload(1),'00000000-0000-0000-0000-000000000301'); raise exception 'Missing insert permission allowed'; exception when insufficient_privilege then null; end;
  begin update public.goods_receipt_doc set source_allocations='[]' where jsonb_array_length(source_allocations)>0; raise exception 'Direct source clearing allowed'; exception when insufficient_privilege then null; end;
  begin perform public.link_receiving_source('hatchery',100,'[{"sourceLineId":1,"quantity":10}]'); raise exception 'Historical linking without permission allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
insert into public.notification_rules(name,module_key,event_key,source_fms_types,recipient_fms_types,user_types,require_view_permission)
 values('Receiving test','HATCHERY_RECEIVING','HATCHERY_RECEIVING_POSTED',array['Hatchery'],array['Hatchery'],array[3]::smallint[],false);
select public.save_hatchery_receiving_with_sources(public.test_receiving_payload(5,2,'NOTIFY-TEST'),'00000000-0000-0000-0000-000000000302');
select public.process_notification_outbox();
do $$ begin
  if (select count(*) from public.user_notifications where recipient_user_id=2)<>1 then raise exception 'Assigned permitted recipient did not receive one delivery'; end if;
  if exists(select 1 from public.user_notifications where recipient_user_id=3) then raise exception 'Wrong farm received event'; end if;
end $$;
update public.notification_outbox set status='pending',next_attempt_at=now() where document_no='NOTIFY-TEST';
select public.process_notification_outbox();
do $$ begin if (select count(*) from public.user_notifications where recipient_user_id=2)<>1 then raise exception 'Dispatcher retry duplicated recipient delivery'; end if; end $$;
-- A missing required farm never becomes unrestricted delivery.
insert into public.recieving(id,brdr_ref_no,dr_num) values(200,'MISSING-FARM','MISSING-FARM');
insert into public.recieving_items(docentry,sku,"UoM",actual_count,brdr_ref_no) values(200,'EGG-TEST','PCS',1,'MISSING-FARM');
do $$ begin if not exists(select 1 from public.notification_outbox where entity_id='200' and module_key='HATCHERY_RECEIVING' and status='invalid') then raise exception 'Missing required farm was not invalid'; end if; end $$;
select 'Access and notification assertions passed' as result;
