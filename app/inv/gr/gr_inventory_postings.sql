create or replace function public.post_goods_receipt_inventory()
returns trigger
language plpgsql
as $$
begin
  if new.status <> 'Posted' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.status = 'Posted' then
    return new;
  end if;

  insert into public.inventory_postings (
    source_doc_type,
    source_docentry,
    item_code,
    warehouse_code,
    bin_code,
    qty,
    created_by,
    ref_type,
    ref,
    transfer_type,
    ref_type2,
    ref2
  )
  select
    'GOODS_RECEIPT',
    new.id,
    gri.item_code,
    gri.warehouse_code,
    'MAIN SUB BIN',
    sum(gri.base_qty),
    coalesce(new.updated_by, new.created_by),
    'batch_code',
    gri.batch_number,
    'IN',
    null,
    null
  from public.goods_receipt_items gri
  where gri.goods_reciept_id = new.id
    and gri.void = '1'
    and gri.item_code is not null
    and gri.warehouse_code is not null
    and gri.base_qty > 0
  group by
    gri.item_code,
    gri.warehouse_code,
    gri.batch_number;

  return new;
end;
$$;

drop trigger if exists post_goods_receipt_inventory_trigger
  on public.goods_receipt;

create trigger post_goods_receipt_inventory_trigger
after update of status
on public.goods_receipt
for each row
when (
  new.status = 'Posted'
  and old.status is distinct from 'Posted'
)
execute function public.post_goods_receipt_inventory();
