begin;
do $$
declare
  v_sql text;
  v_id bigint := (select id from brd_fc limit 1);
  v_count bigint := (select count(*) from notification_outbox);
begin
  if get_brd_fc_posted_harvest(61,'CARD-2') is not null then
    raise exception 'TEST FAILED: old cycle, Draft, Cancelled or other farm/building blocked';
  end if;
  update brd_fc_line set water_l=123 where fc_id=v_id;
  update br_delivery set status='Posted' where id=2;
  if get_brd_fc_posted_harvest(61,'CARD-2') <> 'CURRENT' then raise exception 'TEST FAILED: missing blocker'; end if;
  foreach v_sql in array array[
    'update brd_fc set animal_qty=1',
    'update brd_fc set card_no=''CARD-1''',
    'delete from brd_fc',
    'update brd_fc_line set water_l=999',
    'update brd_fc_line set void=''0''',
    'delete from brd_fc_line',
    format('insert into brd_fc_line(fc_id,age) values(%s,45)',v_id),
    'update brd_fc_ba set alloc_qty=0',
    'delete from brd_fc_ba',
    format('select save_brd_fc_transaction(gen_random_uuid(), ''{"id":%s,"header":{"farm_id":61},"lines":[]}''::jsonb)',v_id)
  ] loop
    begin
      execute v_sql;
      raise exception 'TEST FAILED: mutation allowed: %',v_sql;
    exception when raise_exception then
      if sqlerrm not like 'Growing cannot be changed:%' then raise; end if;
    end;
  end loop;
  if (select count(*) from notification_outbox) <> v_count then raise exception 'TEST FAILED: failed operation emitted event'; end if;
  -- Verify rollback retained the saved rows and data.
  if not exists(select 1 from brd_fc_line where fc_id=v_id and water_l=123)
    or not exists(select 1 from brd_fc_ba) then raise exception 'TEST FAILED: blocked mutation changed data'; end if;
  update br_delivery set status='Posted' where id=5;
  update br_delivery set status='Cancelled' where id=2;
  if get_brd_fc_posted_harvest(61,'CARD-2') <> 'SECOND' then raise exception 'TEST FAILED: remaining Posted harvest ignored'; end if;
  update br_delivery set status='Cancelled' where id=5;
  if get_brd_fc_posted_harvest(61,'CARD-2') is not null then raise exception 'TEST FAILED: voided harvest blocks'; end if;
  update brd_fc set animal_qty=11000 where id=v_id;
  update brd_fc_line set water_l=456 where fc_id=v_id;
  insert into brd_fc_line(fc_id,age) values(v_id,45);
  delete from brd_fc_line where fc_id=v_id and age=45;
  raise notice 'PASS: cycle/building/farm/status matching, remaining Posted, void unlock, header/row/allocation guards and failed-save event rollback';
end;
$$;
rollback;
