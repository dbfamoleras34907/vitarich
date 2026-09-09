begin;

alter table public.inventory_postings
  add column if not exists batch_number text null;

-- Older flock-card origins may predate the inventory-posting trigger. Restore
-- only a missing side of the original source-to-building transfer.
insert into public.inventory_postings (
  source_doc_type,
  source_docentry,
  item_code,
  warehouse_code,
  bin_code,
  batch_number,
  qty,
  created_by,
  ref_type,
  ref,
  transfer_type,
  ref_type2,
  ref2
)
select
  'FLOCK_CARD_ORIGIN',
  origin.id,
  origin.item_code,
  transfer.warehouse_code,
  'DEFAULT',
  origin.batch_no,
  origin.animal_qty,
  coalesce(origin.updated_by, origin.created_by, card.updated_by, card.created_by),
  'BATCH_CODE',
  origin.batch_no,
  transfer.transfer_type,
  'FLOCK_CARD',
  card.card_no
from public.flock_card_origin origin
join public.flock_card card
  on card.id = origin.fc_id
left join public.i_warehouse building
  on building.id = card.building_whse_id
cross join lateral (
  values
    (nullif(btrim(origin.whse_code), ''), 'OUT'::text),
    (
      nullif(btrim(coalesce(card.building_code, building.whse_code, '')), ''),
      'IN'::text
    )
) as transfer(warehouse_code, transfer_type)
where origin.void = '1'
  and origin.animal_qty > 0
  and nullif(btrim(origin.item_code), '') is not null
  and nullif(btrim(origin.batch_no), '') is not null
  and transfer.warehouse_code is not null
  and not exists (
    select 1
    from public.inventory_postings posting
    where posting.source_doc_type = 'FLOCK_CARD_ORIGIN'
      and posting.source_docentry = origin.id
      and posting.item_code = origin.item_code
      and posting.warehouse_code = transfer.warehouse_code
      and posting.transfer_type = transfer.transfer_type
      and coalesce(posting.batch_number, posting.ref) is not distinct from origin.batch_no
  );

commit;
