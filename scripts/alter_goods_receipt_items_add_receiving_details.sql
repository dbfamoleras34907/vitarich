begin;

-- Keep header columns for existing lists and DOC receiving consumers.
-- Backfill only when each column is first added, so rerunning this migration
-- does not overwrite intentionally blank detail values in saved drafts.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'goods_receipt_items'
      and column_name = 'dr_reference'
  ) then
    alter table public.goods_receipt_items add column dr_reference text;
    update public.goods_receipt_items as item
    set dr_reference = receipt.dr_reference
    from public.goods_receipt as receipt
    where receipt.id = item.goods_reciept_id;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'goods_receipt_items'
      and column_name = 'receive_date'
  ) then
    alter table public.goods_receipt_items add column receive_date date;
    update public.goods_receipt_items as item
    set receive_date = receipt.receive_date
    from public.goods_receipt as receipt
    where receipt.id = item.goods_reciept_id;
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
