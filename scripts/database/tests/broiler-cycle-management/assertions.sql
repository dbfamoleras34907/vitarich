\set ON_ERROR_STOP on
set test.auth_uid = '11111111-1111-1111-1111-111111111111';

insert into auth.users values ('11111111-1111-1111-1111-111111111111');
insert into public.users values (1, auth.uid(), '1', 3);
insert into public.user_permissions values (auth.uid(), '/brd/cycle-master/edit', true);
insert into public.farms(id, code, name, associated_warehouses)
values (1, 'FARM-1', 'Test Farm', array[]::jsonb[]);
insert into public.users_farms values (1, 1, '1');
insert into public.i_warehouse(id, whse_code, whse_name, warehouse_type, is_active, farm_id, farm_code)
values
  (10, 'B001', 'Building 1', 'Building', true, 1, 'FARM-1'),
  (20, 'B002', 'Building 2', 'Building', true, 1, 'FARM-1');

insert into public.doc_farm_cycles(farm_id, cycle_no, status)
values (1, 1002, 'Closed'), (1, 1003, 'Saved');
insert into public.flock_card(farm_id, farm_cycle_id, building_whse_id, cycle_no, status, void, extra)
values
  (1, 1, 10, '1002', 'Closed', '1', '{"createdFrom":"DOC_RECEIVING"}'),
  (1, 2, 10, '1003', 'Saved', '1', '{"createdFrom":"DOC_RECEIVING"}');

drop trigger if exists validate_doc_flock_cycle_assignment_trigger on public.flock_card;
create trigger validate_doc_flock_cycle_assignment_trigger
before insert or update of farm_id, building_whse_id, cycle_no, farm_cycle_id, status, extra, void
on public.flock_card for each row
execute function public.validate_doc_flock_cycle_assignment();

do $$ begin
  begin
    perform public.set_broiler_farm_cycle_state(1, 'reopen');
    raise exception 'A second open cycle was allowed for one building';
  exception when others then
    if sqlerrm <> 'This cycle cannot be reopened because building B001 already has an open cycle.' then raise; end if;
  end;
  if (select status <> 'Closed' from public.doc_farm_cycles where id = 1) then raise exception 'Blocked reopen changed the closed farm cycle'; end if;
  if (select status <> 'Closed' from public.flock_card where farm_cycle_id = 1) then raise exception 'Blocked reopen changed the closed building cycle'; end if;
end $$;

do $$ begin
  begin
    perform public.set_broiler_farm_cycle_state(2, 'close');
    raise exception 'Current building cycle was allowed to close';
  exception when others then
    if sqlerrm <> 'Current Cycle cannot be closed while it is still current for a building.' then raise; end if;
  end;
  if (select status <> 'Saved' from public.doc_farm_cycles where id = 2) then
    raise exception 'Blocked Current Cycle close changed the farm cycle';
  end if;
  if (select status <> 'Saved' from public.flock_card where farm_cycle_id = 2) then
    raise exception 'Blocked Current Cycle close changed the building cycle';
  end if;
end $$;

update public.flock_card set status = 'Closed' where farm_cycle_id = 2;
select public.set_broiler_farm_cycle_state(2, 'close');
do $$ begin
  if (select status <> 'Closed' from public.doc_farm_cycles where id = 2) then
    raise exception 'Current Cycle was not closed';
  end if;
  if (select status <> 'Closed' from public.flock_card where farm_cycle_id = 2) then raise exception 'Completed building cycle changed unexpectedly'; end if;
  if (select status <> 'Closed' from public.doc_farm_cycles where id = 1) then raise exception 'Closing Current Cycle changed the older Closed Cycle'; end if;
end $$;

select public.set_broiler_farm_cycle_state(1, 'reopen');
do $$ begin
  if (select status <> 'Past Open' from public.doc_farm_cycles where id = 1) then raise exception 'Closed cycle was not reopened as Past Open'; end if;
  if (select status <> 'Saved' from public.flock_card where farm_cycle_id = 1) then raise exception 'Past-cycle flock card was not reopened'; end if;
end $$;

select public.open_broiler_past_cycle(
  1,
  20,
  (date_trunc('month', current_date) - interval '2 months')::date
);
do $$
declare
  v_month date := (date_trunc('month', current_date) - interval '2 months')::date;
begin
  if not exists (
    select 1
    from public.doc_farm_cycles cycle
    join public.flock_card card on card.farm_cycle_id = cycle.id
    where cycle.farm_id = 1
      and cycle.status = 'Past Open'
      and card.building_whse_id = 20
      and card.start_date = v_month
      and card.status = 'Saved'
      and card.animal_qty = 0
      and card.extra->>'createdFrom' = 'CYCLE_MASTER_PAST'
  ) then
    raise exception 'Open Past Cycle did not create the expected empty building cycle';
  end if;

  begin
    perform public.open_broiler_past_cycle(1, 20, v_month);
    raise exception 'A second open cycle was accepted for one building';
  exception when others then
    if sqlerrm <> 'This building already has an open cycle. Close the open cycle before creating another one.' then raise; end if;
  end;

  begin
    insert into public.flock_card(farm_id, building_whse_id, cycle_no, status, void, extra)
    values (1, 20, '9999', 'Saved', '1', '{}');
    raise exception 'The shared flock-card trigger accepted a second open cycle';
  exception when others then
    if sqlerrm <> 'This building already has an open cycle. Close the open cycle before creating or reopening another one.' then raise; end if;
  end;

  begin
    perform public.open_broiler_past_cycle(1, 20, date_trunc('month', current_date)::date);
    raise exception 'Current month was accepted as a past cycle';
  exception when others then
    if sqlerrm <> 'Open Past Cycle requires a month before the current month.' then raise; end if;
  end;
end $$;

update public.user_permissions set is_visible = false;
do $$ begin
  begin
    perform public.set_broiler_farm_cycle_state(1, 'close');
    raise exception 'Missing Cycle Master permission was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.open_broiler_past_cycle(
      1,
      20,
      (date_trunc('month', current_date) - interval '3 months')::date
    );
    raise exception 'Open Past Cycle accepted a missing Cycle Master permission';
  exception when insufficient_privilege then null;
  end;
end $$;

select 'Broiler cycle management assertions passed' as result;
