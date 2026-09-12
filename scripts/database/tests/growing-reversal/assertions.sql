-- TEST ONLY: disposable database prepared by prepare_fixture.py.
begin;
insert into flock_card(card_no,farm_id,building_whse_id,building_code,cycle_no,animal_qty)
values('PLACEMENT',61,10,'B1','1',100);
insert into flock_card_origin values(1,1,'BIRD','DOC:F61:B10:1',100,'1');
insert into brd_fc(fc_no,card_no,farm_id,building_whse_id,building_code) values('GROWING','PLACEMENT',61,10,'B1');
insert into brd_fc_line(fc_id,age,mort_am,mort_total,feed_kg,water_l,body_wt,extra)
select 1,age,2,2,3,10,20,'{"mortalityBatchAllocations":[{"itemCode":"BIRD","batchNumber":"DOC:F61:B10:1","allocatedQty":2}]}'
from generate_series(0,1) age;
insert into brd_fc_ba(fc_line_id,line_no,item_code,batch_no,whse_code,alloc_qty)
select id,1,'FEED','FD-2609-2709-002','FEEDS',3 from brd_fc_line;
insert into inventory_postings(item_code,warehouse_code,qty,ref,transfer_type) values('BIRD','B1',100,'DOC:F61:B10:1','IN');
insert into inventory_postings(source_doc_type,source_docentry,item_code,warehouse_code,qty,ref,transfer_type)
select 'BRD_FC_MORT_THIN_TRANSFER_OUT',id*1000000+1,'BIRD','B1',2,'DOC:F61:B10:1','OUT' from brd_fc_line
union all select 'BRD_FC_MORT_THIN_TRANSFER_IN',id*1000000+1,'BIRD','DISPOSAL',2,'DOC:F61:B10:1','IN' from brd_fc_line
union all select 'BRD_FC_FEED_USAGE',id,'FEED','FEEDS',3,'FD-2609-2709-002','OUT' from brd_fc_ba;
commit;

-- Repeated edits with the same quantity must reverse one exact posting at a
-- time. This reproduces the equal-quantity history that previously allowed one
-- reversal to hide multiple OUT rows.
update brd_fc_line
set extra = jsonb_set(extra, '{guardVersion}', '1')
where age = 1;
update brd_fc_line
set extra = jsonb_set(extra, '{guardVersion}', '2')
where age = 1;
do $$
declare
  v_line_id bigint := (select id from brd_fc_line where age = 1);
begin
  if exists(select 1 from get_brd_fc_mort_thin_inventory_discrepancies()) then
    raise exception 'TEST FAILED: equal-quantity edit left an inventory discrepancy';
  end if;
  if (select count(*) from inventory_postings reversal
      join inventory_postings source on source.id = reversal.reverses_posting_id
      where reversal.source_doc_type = 'BRD_FC_MORT_THIN_REVERSAL'
        and source.source_doc_type = 'BRD_FC_MORT_THIN_TRANSFER_OUT'
        and source.source_docentry between v_line_id * 1000000 and v_line_id * 1000000 + 999999) <> 2 then
    raise exception 'TEST FAILED: equal-quantity edits were not linked one-to-one';
  end if;
end;
$$;

-- Even a direct/legacy writer cannot commit a Growing inventory movement that
-- disagrees with the persisted line.
do $$
declare
  v_line_id bigint := (select id from brd_fc_line where age = 1);
begin
  begin
    insert into inventory_postings (
      source_doc_type, source_docentry, item_code, warehouse_code, qty, ref, transfer_type
    ) values (
      'BRD_FC_MORT_THIN_TRANSFER_OUT', v_line_id * 1000000 + 990001,
      'BIRD', 'B1', 1, 'DOC:F61:B10:1', 'OUT'
    );
    set constraints enforce_brd_fc_mort_thin_posting_balance immediate;
    raise exception 'TEST FAILED: imbalanced direct posting committed';
  exception when raise_exception then
    if sqlerrm not like 'Growing mortality/thinning inventory is out of balance%' then raise; end if;
  end;
end;
$$;

create function test_expect_block(expected text) returns void language plpgsql as $$
begin
  begin
    perform reverse_brd_fc_transaction(1,'Test reversal');
    raise exception 'TEST FAILED: reversal unexpectedly succeeded';
  exception when others then
    if position(expected in sqlerrm) = 0 then raise; end if;
  end;
  if exists(select 1 from brd_fc_reversal_requests) or exists(select 1 from notification_outbox) then
    raise exception 'TEST FAILED: blocked action left a receipt or event';
  end if;
end; $$;
update users set user_type=2;
select test_expect_block('Only Super Admin');
update users set user_type=1;

insert into br_delivery values(1,61,'Draft',10,'B1');
insert into br_delivery_lines values(1,1,10,'B1','BIRD','DOC:F61:B10:1','1');
select test_expect_block('blocked by an active Harvest or Clean Up');
update br_delivery set status='Posted';
select test_expect_block('blocked by an active Harvest or Clean Up');
-- A previous cycle in the same building must not block this cycle.
update br_delivery_lines set batch_number='DOC:F61:B10:0';
insert into br_cleanup values(1,61,'Draft',10,'B1');
insert into br_cleanup_lines values(1,1,10,'B1','BIRD','DOC:F61:B10:1','1');
select test_expect_block('blocked by an active Harvest or Clean Up');
update br_cleanup set status='Posted';
select test_expect_block('blocked by an active Harvest or Clean Up');
update br_cleanup set status='Cancelled';

-- Fail after an earlier row has reversed, proving rollback of inventory and events.
create function fail_test_reversal() returns trigger language plpgsql as $$
begin
  if new.age=0 and new.void='0' then raise exception 'Injected reversal failure'; end if;
  return new;
end; $$;
create trigger fail_reversal before update on brd_fc_line for each row execute function fail_test_reversal();
select test_expect_block('Injected reversal failure');
do $$begin
  if exists(select 1 from brd_fc_line where void <> '1' or mort_am <> 2 or feed_kg <> 3)
    or (select count(*) from inventory_postings) <> 16 then
    raise exception 'TEST FAILED: partial reversal persisted';
  end if;
end;$$;
drop trigger fail_reversal on brd_fc_line;

-- Invoke as an authenticated client, with no direct data write permissions.
set role authenticated;
select reverse_brd_fc_transaction(1,'Correct the Growing entries');
reset role;
do $$begin
  if exists(select 1 from brd_fc where void='1') or exists(select 1 from brd_fc_line where void='1')
    or exists(select 1 from brd_fc_ba where void='1') then raise exception 'TEST FAILED: active Growing remains'; end if;
  if not exists(select 1 from flock_card where id=1 and void='1' and status='Saved' and cycle_no='1' and animal_qty=100)
    or (select animal_qty from flock_card_origin where id=1) <> 100 then raise exception 'TEST FAILED: placement changed'; end if;
  if (select sum(case when transfer_type='OUT' then -qty else qty end) from inventory_postings where warehouse_code='B1') <> 100
    or (select sum(case when transfer_type='OUT' then -qty else qty end) from inventory_postings where warehouse_code='DISPOSAL') <> 0
    or (select sum(case when transfer_type='OUT' then -qty else qty end) from inventory_postings where warehouse_code='FEEDS') <> 100 then
    raise exception 'TEST FAILED: inventory was not restored'; end if;
  if (select count(*) from notification_outbox) <> 1 or not exists(select 1 from notification_outbox where event_key='BRD_FC_VOIDED') then
    raise exception 'TEST FAILED: expected one full reversal event'; end if;
  if not exists(select 1 from brd_fc_reversal_requests where jsonb_array_length(line_snapshot)=2
    and line_snapshot->0->>'water_l' is not null and reason='Correct the Growing entries') then
    raise exception 'TEST FAILED: missing original audit snapshot'; end if;
end; $$;
-- No active rule must not change the business result or create deliveries.
select process_notification_outbox();
do $$begin
  if exists(select 1 from notification_outbox where status in ('failed','invalid'))
    or exists(select 1 from user_notifications) then raise exception 'TEST FAILED: no-rule dispatch'; end if;
end;$$;
-- Retry must not affect a newly started Growing record for the retained cycle.
insert into brd_fc(fc_no,card_no,farm_id,building_whse_id,building_code) values('RESTART','PLACEMENT',61,10,'B1');
select reverse_brd_fc_transaction(1,'Retry after a lost response');
do $$begin
  if (select count(*) from notification_outbox) <> 1 or not exists(select 1 from brd_fc where fc_no='RESTART' and void='1') then
    raise exception 'TEST FAILED: retry duplicated an event or reversed new Growing'; end if;
end;$$;
select 'PASS: authorization, harvest/cleanup, rollback, exact reversal links, balance guards, audit, retry, restart and no-rule dispatch';

-- Activate a rule only in this disposable database; delivery retries stay unique.
insert into notification_rules(name,module_key,event_key,exclude_actor)
values('Test','BRD_FC','BRD_FC_VOIDED',false);
select reverse_brd_fc_transaction(2,'Clear restarted Growing');
select process_notification_outbox();
select process_notification_outbox();
do $$begin
  if (select count(*) from user_notifications) <> 1 then raise exception 'TEST FAILED: expected one recipient delivery'; end if;
end;$$;
-- A missing required farm must be invalid even when a matching rule exists.
insert into notification_outbox(module_key,event_key,entity_type,entity_id,document_no,
  fms_type,actor_auth_id,target_url,permission_group,permission_title,title,message,dedupe_key)
values('BRD_FC','BRD_FC_VOIDED','brd_fc','2','RESTART','Broiler',auth.uid(),
  '/brd/fc','Menus','Growing & Farm Condition/view','Invalid test','Invalid test','TEST:MISSING:FARM');
select process_notification_outbox();
do $$begin
  if not exists(select 1 from notification_outbox where dedupe_key='TEST:MISSING:FARM' and status='invalid')
    or (select count(*) from user_notifications) <> 1 then raise exception 'TEST FAILED: missing farm broadened delivery'; end if;
end;$$;
select 'PASS: rule delivery deduplication and missing-farm invalidation';
