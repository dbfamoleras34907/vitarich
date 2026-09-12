-- Apply after deploy_harvest_emptied_cleanup.sql.
-- Recognize consolidated DOC inventory even when flock_card_origin is empty.
begin;

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

notify pgrst, 'reload schema';
commit;
