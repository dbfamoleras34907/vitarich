set role authenticated;
do $$
declare
 d jsonb := '{"giNo":"HARVEST-TEST","farmId":1,"status":"Draft","lines":[{"id":"new","allocationGroupKey":"group-1","itemCode":"DOC","altQty":5,"baseQty":5,"altUom":"PCS","baseUom":"PCS","netLiveWeight":12.5}]}'::jsonb;
 r jsonb;
begin
 r := save_br_delivery_transaction(d);
 assert (r->'lines'->0->>'net_live_weight')::numeric = 12.5, 'weight persisted';
 assert r->'header'->>'farm_code' = 'FARM-A', 'canonical farm';
 d := jsonb_set(d, '{id}', r->'header'->'id');
 d := jsonb_set(d, '{lines,0,id}', r->'lines'->0->'id');
 perform save_br_delivery_transaction(d);
 d := jsonb_set(d, '{lines,0,netLiveWeight}', '15');
 perform save_br_delivery_transaction(d);
 perform save_br_delivery_transaction(d);
 d := jsonb_set(d, '{lines,0,netLiveWeight}', '12.5');
 perform save_br_delivery_transaction(d);
 begin
   perform save_br_delivery_transaction(jsonb_set(d, '{lines,0,netLiveWeight}', '-1'));
   raise exception 'negative accepted';
 exception when check_violation then null;
 end;
 begin
   perform save_br_delivery_transaction(jsonb_set(d, '{farmId}', '999'));
   raise exception 'invalid farm accepted';
 exception when raise_exception then
   if sqlerrm = 'invalid farm accepted' then raise; end if;
 end;
 d := jsonb_set(d, '{status}', '"Posted"');
 perform save_br_delivery_transaction(d);
 begin
   perform save_br_delivery_transaction(d);
   raise exception 'posted retry accepted';
 exception when raise_exception then
   if sqlerrm = 'posted retry accepted' then raise; end if;
 end;
end $$;
reset role;
do $$ begin
 assert (select count(*) from notification_outbox) = 3, 'two edits and one post only';
 assert (select count(*) from notification_outbox where event_key = 'BR_DELIVERY_EDITED') = 2;
 assert (select count(*) from notification_outbox where event_key = 'BR_DELIVERY_POSTED') = 1;
 assert (select net_live_weight from br_delivery_lines where void = '1') = 12.5;
 assert (select bool_and(farm_id = 1 and recipient_farm_id = 1) from notification_outbox);
end $$;
select 'PASS: persistence, canonical farm, protected outbox trigger, edit retries, A-B-A edits, rejected negative weight, invalid farm, post retry';
