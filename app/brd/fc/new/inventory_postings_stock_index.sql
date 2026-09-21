-- Run separately with autocommit enabled. Do not wrap this statement in BEGIN/COMMIT.
create index concurrently if not exists inventory_postings_stock_lookup_idx
  on public.inventory_postings (item_code, warehouse_code, ref)
  include (qty, transfer_type);
