-- Apply after br_cleanup_tables.sql and notification_system.sql.
begin;

-- The same persisted evidence drives form eligibility and posting validation.
create or replace function public.get_harvest_emptied_cleanup_batches(p_flock_card_id bigint)
returns table(item_code text, item_name text, batch_number text, warehouse_code text)
language sql stable security invoker set search_path = public
as $$
  with cycle as (
    select card.* from public.flock_card card
    join public.farms farm on farm.id = card.farm_id
    where card.id = p_flock_card_id and card.void = '1' and card.status = 'Saved'
  ), origins as (
    -- DOC Receiving can populate the consolidated ledger without origin rows.
    -- Match the persisted cycle identity exactly; never infer a cycle from zero stock.
    select distinct btrim(posting.item_code) as item_code, cycle.building_code as warehouse_code,
      cycle.farm_id, cycle.start_date,
      format('DOC:F%s:B%s:%s', cycle.farm_id, cycle.building_whse_id, btrim(cycle.cycle_no)) as batch_number
    from cycle join public.inventory_postings posting
      on posting.source_doc_type = 'DOC_RECEIVING_CONSOLIDATION'
     and posting.transfer_type = 'IN' and posting.qty > 0
     and upper(btrim(posting.warehouse_code)) = upper(btrim(cycle.building_code))
     and upper(btrim(coalesce(posting.batch_number, posting.ref))) = upper(format('DOC:F%s:B%s:%s', cycle.farm_id, cycle.building_whse_id, btrim(cycle.cycle_no)))
    where nullif(btrim(posting.item_code), '') is not null
      and cycle.building_whse_id is not null and nullif(btrim(cycle.cycle_no), '') is not null
    union
    select distinct btrim(origin.item_code) as item_code, cycle.building_code as warehouse_code,
      cycle.farm_id, cycle.start_date,
      case when exists (
        select 1 from public.inventory_postings posting
        where posting.source_doc_type = 'DOC_RECEIVING_CONSOLIDATION' and posting.transfer_type = 'IN'
          and upper(btrim(posting.item_code)) = upper(btrim(origin.item_code))
          and upper(btrim(posting.warehouse_code)) = upper(btrim(cycle.building_code))
          and upper(btrim(coalesce(posting.batch_number, posting.ref))) = upper(format('DOC:F%s:B%s:%s', cycle.farm_id, cycle.building_whse_id, btrim(cycle.cycle_no)))
      ) then format('DOC:F%s:B%s:%s', cycle.farm_id, cycle.building_whse_id, btrim(cycle.cycle_no))
        else btrim(origin.batch_no) end as batch_number
    from cycle join public.flock_card_origin origin on origin.fc_id = cycle.id and origin.void = '1'
    where nullif(btrim(origin.item_code), '') is not null and nullif(btrim(origin.batch_no), '') is not null
  ), movements as (
    select posting.*, origin.farm_id, origin.start_date
    from origins origin join public.inventory_postings posting
      on upper(btrim(posting.item_code)) = upper(origin.item_code)
     and upper(btrim(posting.warehouse_code)) = upper(btrim(origin.warehouse_code))
     and upper(btrim(coalesce(posting.batch_number, posting.ref))) = upper(origin.batch_number)
  ), balances as (
    select origin.item_code, origin.warehouse_code, origin.batch_number,
      coalesce(sum(case when posting.transfer_type = 'OUT' then -posting.qty else posting.qty end), 0) as qty
    from origins origin left join movements posting
      on upper(btrim(posting.item_code)) = upper(origin.item_code)
     and upper(btrim(coalesce(posting.batch_number, posting.ref))) = upper(origin.batch_number)
    group by origin.item_code, origin.warehouse_code, origin.batch_number
  ), last_movement as (
    select * from movements where qty > 0 order by id desc limit 1
  )
  select balance.item_code, coalesce(item.item_name, balance.item_code), balance.batch_number, balance.warehouse_code
  from balances balance left join public.items item on item.item_code = balance.item_code
  where not exists (select 1 from balances where qty <> 0)
    and exists (
      select 1 from last_movement movement join public.br_delivery harvest
        on harvest.id = movement.source_docentry and harvest.farm_id = movement.farm_id
      where movement.source_doc_type = 'BR_DELIVERY' and movement.transfer_type = 'OUT'
        and harvest.status = 'Posted' and harvest.issue_date >= movement.start_date::date
    );
$$;
revoke all on function public.get_harvest_emptied_cleanup_batches(bigint) from public, anon;
grant execute on function public.get_harvest_emptied_cleanup_batches(bigint) to authenticated;

alter table public.br_cleanup_lines drop constraint if exists br_cleanup_lines_qty_check;
alter table public.br_cleanup_lines add constraint br_cleanup_lines_qty_check check (
  ((alt_qty >= 1 and base_qty > 0) or (alt_qty = 0 and base_qty = 0))
  and batch_total_qty >= 0 and variance_qty >= 0
);

-- Preserve the deployed posting/variance implementation and its age rules.
do $$
declare v_definition text;
begin
  select pg_get_functiondef('public.post_br_cleanup_inventory()'::regprocedure) into v_definition;
  v_definition := replace(v_definition, chr(13), '');
  if position('get_harvest_emptied_cleanup_batches' in v_definition) = 0 then
    if position('Clean up requires at least one positive quantity line.' in v_definition) = 0 then
      raise exception 'Unexpected cleanup posting function; inspect before applying the zero-harvest change.';
    end if;
    v_definition := replace(v_definition,
      'and line.base_qty > 0' || chr(10) || '  ) then',
      'and line.base_qty >= 0' || chr(10) || '  ) then');
    v_definition := replace(v_definition, 'Clean up requires at least one positive quantity line.', 'Clean up requires at least one line.');
    v_definition := replace(v_definition, '(line.alt_qty < 1 or line.base_qty <= 0)',
      'not ((line.alt_qty >= 1 and line.base_qty > 0) or (line.alt_qty = 0 and line.base_qty = 0))');
    v_definition := replace(v_definition, '  select coalesce(settings.target_cleanup_age, 0)', $guard$
  -- Serialize with Harvest posting before reading its ledger evidence.
  perform pg_advisory_xact_lock(hashtextextended('BR_DELIVERY_INVENTORY_POST', 0));
  if exists (
    select 1 from public.br_cleanup_lines line
    where line.br_cleanup_id = new.id and line.void = '1' and line.base_qty = 0
      and not exists (
        select 1 from public.flock_card card
        cross join lateral public.get_harvest_emptied_cleanup_batches(card.id) batch
        where card.farm_id = new.farm_id
          and card.building_whse_id = line.from_warehouse_id
          and upper(btrim(batch.warehouse_code)) = upper(btrim(line.from_warehouse_code))
          and upper(batch.item_code) = upper(btrim(line.item_code))
          and upper(batch.batch_number) = upper(btrim(line.batch_number))
      )
  ) then
    raise exception 'Zero-quantity Clean Up requires a posted harvest that emptied the current cycle.';
  end if;

  select coalesce(settings.target_cleanup_age, 0)$guard$);
    if position('get_harvest_emptied_cleanup_batches' in v_definition) = 0
      or position('and line.base_qty >= 0' in v_definition) = 0 then
      raise exception 'Cleanup posting patch did not match; no changes applied.';
    end if;
  end if;
  -- A verified harvest closeout qualifies without a mortality-age entry.
  -- Keep the existing age requirement for cleanup of a positive balance.
  v_definition := replace(v_definition,
    'where active.id is null' || chr(10) || '     or active.actual_age is null' || chr(10) || '     or active.actual_age < v_target_age',
    'where (active.id is null or active.actual_age is null or active.actual_age < v_target_age)' || chr(10) ||
    '    and not exists (select 1 from public.get_harvest_emptied_cleanup_batches(active.id))');

  -- A zero-quantity cleanup must still leave its own inventory ledger record.
  v_definition := replace(v_definition,
    'and line.base_qty > 0' || chr(10) || '  group by line.item_code, line.from_warehouse_code, line.batch_number;',
    'and line.base_qty >= 0' || chr(10) || '  group by line.item_code, line.from_warehouse_code, line.batch_number;');
  if position('get_harvest_emptied_cleanup_batches(active.id)' in v_definition) = 0
    or position('and line.base_qty >= 0' || chr(10) || '  group by line.item_code, line.from_warehouse_code, line.batch_number;' in v_definition) = 0 then
    raise exception 'Cleanup closeout patch did not match; no changes applied.';
  end if;
  execute v_definition;
end;
$$;

notify pgrst, 'reload schema';
commit;
