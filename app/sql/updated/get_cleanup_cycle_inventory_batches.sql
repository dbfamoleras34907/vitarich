-- Clean Up selects a farm and Cycle Master before loading its buildings.
-- Resolve the Posted DOC Placement batches for that exact cycle first, then
-- aggregate only those warehouse/item/batch keys in the inventory ledger.

begin;

create index if not exists flock_card_cleanup_cycle_lookup_idx
  on public.flock_card (farm_id, farm_cycle_id, building_whse_id)
  include (id, building_code, cycle_no)
  where void = '1' and status = 'Saved';

create index if not exists goods_receipt_doc_flock_card_active_idx
  on public.goods_receipt_doc (flock_card_id, goods_reciept_id)
  include (building_warehouse_id)
  where void = '1';

create or replace function public.get_cleanup_cycle_inventory_batches(
  p_farm_id bigint,
  p_farm_cycle_id bigint
)
returns table(
  flock_card_id bigint,
  building_warehouse_id bigint,
  building_code text,
  item_code text,
  item_name text,
  batch_number text,
  warehouse_code text,
  on_hand_qty numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with cycle_cards as materialized (
    select
      card.id as flock_card_id,
      card.building_whse_id as building_warehouse_id,
      warehouse.whse_code as building_code,
      format(
        'DOC:F%s:B%s:%s',
        card.farm_id,
        card.building_whse_id,
        btrim(card.cycle_no)
      ) as placement_batch
    from public.flock_card card
    join public.i_warehouse warehouse
      on warehouse.id = card.building_whse_id
    where card.farm_id = p_farm_id
      and card.farm_cycle_id = p_farm_cycle_id
      and card.void = '1'
      and card.status = 'Saved'
      and card.building_whse_id is not null
      and nullif(btrim(card.cycle_no), '') is not null
  ), placement_batches as materialized (
    select distinct
      card.flock_card_id,
      card.building_warehouse_id,
      card.building_code,
      placement.item_code,
      placement.batch_number,
      placement.warehouse_code
    from cycle_cards card
    join public.goods_receipt_doc detail
      on detail.flock_card_id = card.flock_card_id
     and detail.building_warehouse_id = card.building_warehouse_id
     and detail.void = '1'
    join public.goods_receipt receipt
      on receipt.id = detail.goods_reciept_id
     and receipt.farm_id = p_farm_id
     and receipt.status = 'Posted'
    join public.inventory_postings placement
      on placement.source_doc_type = 'DOC_RECEIVING_CONSOLIDATION'
     and placement.source_docentry = receipt.id
     and placement.transfer_type = 'IN'
     and placement.warehouse_code = card.building_code
     and placement.batch_number = card.placement_batch
     and placement.qty > 0
  )
  select
    batch.flock_card_id,
    batch.building_warehouse_id,
    batch.building_code,
    batch.item_code,
    coalesce(item.item_name, batch.item_code) as item_name,
    batch.batch_number,
    batch.warehouse_code,
    sum(case when ledger.transfer_type = 'OUT' then -ledger.qty else ledger.qty end)::numeric as on_hand_qty
  from placement_batches batch
  join public.inventory_postings ledger
    on ledger.item_code = batch.item_code
   and ledger.warehouse_code = batch.warehouse_code
   and ledger.batch_number = batch.batch_number
  left join public.items item
    on item.item_code = batch.item_code
  group by
    batch.flock_card_id,
    batch.building_warehouse_id,
    batch.building_code,
    batch.item_code,
    item.item_name,
    batch.batch_number,
    batch.warehouse_code
  having sum(case when ledger.transfer_type = 'OUT' then -ledger.qty else ledger.qty end) >= 0
  order by batch.building_code, batch.item_code, batch.batch_number;
$$;

revoke all on function public.get_cleanup_cycle_inventory_batches(bigint, bigint)
  from public, anon;
grant execute on function public.get_cleanup_cycle_inventory_batches(bigint, bigint)
  to authenticated;

alter table public.br_cleanup_lines
  drop constraint if exists br_cleanup_lines_qty_check;
alter table public.br_cleanup_lines
  add constraint br_cleanup_lines_qty_check check (
    ((alt_qty >= 1 and base_qty > 0) or (alt_qty = 0 and base_qty = 0))
    and batch_total_qty >= 0
    and variance_qty >= 0
  );

-- Replace the old Harvest-based zero-closeout proof in the authoritative
-- posting trigger. A zero line is valid only when it matches a zero-balance
-- DOC Placement batch returned for this exact farm and Cycle Master.
do $patch$
declare v_definition text;
begin
  select pg_get_functiondef('public.post_br_cleanup_inventory()'::regprocedure)
  into v_definition;
  v_definition := replace(v_definition, chr(13), '');

  if position('cross join lateral public.get_harvest_emptied_cleanup_batches(card.id) batch' in v_definition) > 0 then
    v_definition := replace(
      v_definition,
      'cross join lateral public.get_harvest_emptied_cleanup_batches(card.id) batch',
      'cross join lateral public.get_cleanup_cycle_inventory_batches(new.farm_id, new.farm_cycle_id) batch'
    );
    v_definition := replace(
      v_definition,
      'and upper(batch.batch_number) = upper(btrim(line.batch_number))',
      'and upper(batch.batch_number) = upper(btrim(line.batch_number))' || chr(10) ||
      '          and batch.on_hand_qty = 0'
    );
    v_definition := replace(
      v_definition,
      'and not exists (select 1 from public.get_harvest_emptied_cleanup_batches(active.id))',
      'and not (' || chr(10) ||
      '      exists (' || chr(10) ||
      '        select 1 from public.get_cleanup_cycle_inventory_batches(new.farm_id, new.farm_cycle_id) batch' || chr(10) ||
      '        where batch.flock_card_id = active.id' || chr(10) ||
      '      )' || chr(10) ||
      '      and not exists (' || chr(10) ||
      '        select 1 from public.get_cleanup_cycle_inventory_batches(new.farm_id, new.farm_cycle_id) batch' || chr(10) ||
      '        where batch.flock_card_id = active.id and batch.on_hand_qty <> 0' || chr(10) ||
      '      )' || chr(10) ||
      '    )'
    );
    v_definition := replace(
      v_definition,
      'Zero-quantity Clean Up requires a posted harvest that emptied the current cycle.',
      'Zero-quantity Clean Up requires a zero-balance DOC Placement batch from the selected cycle.'
    );
    execute v_definition;
  elsif position('get_cleanup_cycle_inventory_batches(new.farm_id, new.farm_cycle_id)' in v_definition) = 0 then
    raise exception 'Unexpected cleanup posting function; apply the current zero-closeout update first.';
  end if;
end;
$patch$;

notify pgrst, 'reload schema';

commit;
-- 