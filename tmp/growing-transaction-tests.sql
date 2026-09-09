do $$
declare
 p jsonb := '{"id": null, "header": {"fc_no": "FC-TEST", "fc_date": "2026-09-09", "farm_id": 61, "animal_qty": 11120}, "lines": [{"age": 0, "insert": {"mort_am": null, "mort_pm": null, "mort_total": 4, "thin_am": null, "thin_pm": null, "row_total": null, "cum_total": null, "feed_kg": null, "feed_bird": null, "feed_guideline": null, "feed_batch_text": null, "water_l": 258.1, "water_bird": null, "body_wt": null, "body_guideline": null, "temp_min": null, "temp_max": null, "hum_min": null, "hum_max": null, "nh3_max": null, "skin_b": null, "skin_a": null, "skin_l": null, "extra": {"feedTypeId": 29}, "is_locked": false}, "update": {"mort_am": null, "mort_pm": null, "mort_total": 4, "thin_am": null, "thin_pm": null, "row_total": null, "cum_total": null, "feed_kg": null, "feed_bird": null, "feed_guideline": null, "feed_batch_text": null, "water_l": 258.1, "water_bird": null, "body_wt": null, "body_guideline": null, "temp_min": null, "temp_max": null, "hum_min": null, "hum_max": null, "nh3_max": null, "skin_b": null, "skin_a": null, "skin_l": null, "extra": {"feedTypeId": 29}, "is_locked": false}, "feed": {"p_feed_kg": 3, "p_feed_bird": 0.27, "p_feed_guideline": null, "p_feed_batch_text": "FD-2609-2709-002 (3)", "p_feed_type_id": 29, "p_allocations": [{"itemId": 1, "itemCode": "FEED", "batchNumber": "FD-2609-2709-002", "warehouseCode": "FEEDS", "allocatedQty": 3, "onHandSnapshot": 100}]}}]}'::jsonb;
 bad jsonb;
 result jsonb;
 request uuid := '22222222-2222-2222-2222-222222222222';
 old_rows jsonb;
 old_postings bigint;
begin
 bad := jsonb_set(p, '{lines,0,feed,p_allocations,0,itemCode}', '"WRONG"');
 begin
   perform save_brd_fc_transaction(request,bad);
   raise exception 'TEST FAILED: bad feed succeeded';
 exception when raise_exception then
   if sqlerrm not like 'Age 0: Unable to save feed intake:%' then raise; end if;
 end;
 if exists(select 1 from brd_fc) or exists(select 1 from brd_fc_line)
    or exists(select 1 from brd_fc_ba) or exists(select 1 from brd_fc_save_requests)
    or exists(select 1 from notification_outbox) or (select count(*) from inventory_postings)<>1 then
   raise exception 'TEST FAILED: failed insert left partial data';
 end if;
 result := save_brd_fc_transaction(request,p);
 if (select feed_kg from brd_fc_line where fc_id=(result->>'id')::bigint)<>3 then
   raise exception 'TEST FAILED: valid level-1 type with deeper leaf not saved';
 end if;
 if (select count(*) from notification_outbox)<>1 then raise exception 'TEST FAILED: missing event'; end if;
 select count(*) into old_postings from inventory_postings;
 perform save_brd_fc_transaction(request,p);
 if (select count(*) from inventory_postings)<>old_postings or (select count(*) from notification_outbox)<>1 then
   raise exception 'TEST FAILED: retry duplicated inventory/event';
 end if;
 begin
   perform save_brd_fc_transaction(request,bad);
   raise exception 'TEST FAILED: changed request accepted';
 exception when raise_exception then
   if sqlerrm not like 'Save request ID was already used%' then raise; end if;
 end;
 p := jsonb_set(p,'{id}',result->'id');
 select jsonb_agg(to_jsonb(l) order by age) into old_rows from brd_fc_line l;
 bad := jsonb_set(p,'{lines,0,update,water_l}','999');
 bad := jsonb_set(bad,'{lines}',(bad->'lines') || jsonb_build_array(
   jsonb_set(jsonb_set(p->'lines'->0,'{age}','1'),'{feed,p_allocations,0,itemCode}','"WRONG"')));
 begin
   perform save_brd_fc_transaction(gen_random_uuid(),bad);
   raise exception 'TEST FAILED: later age failure accepted';
 exception when raise_exception then
   if sqlerrm not like 'Age 1: Unable to save feed intake:%' then raise; end if;
 end;
 if (select jsonb_agg(to_jsonb(l) order by age) from brd_fc_line l) is distinct from old_rows
    or (select count(*) from inventory_postings)<>old_postings
    or (select count(*) from notification_outbox)<>1 then
   raise exception 'TEST FAILED: edit rollback changed earlier age/inventory/event';
 end if;
 raise notice 'PASS: invalid feed rollback, level-one hierarchy success, retries deduped, changed-request rejection, later-age edit rollback';
end;
$$;
