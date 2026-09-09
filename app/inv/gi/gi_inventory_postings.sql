create or replace function public.post_goods_issue_inventory()
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

  if exists (
    with issue_qty as (
      select
        gii.item_code,
        gii.from_warehouse_code as warehouse_code,
        gii.batch_number,
        sum(gii.base_qty) as required_qty
      from public.goods_issue_items gii
      where gii.goods_issue_id = new.id
        and gii.void = '1'
        and gii.item_code is not null
        and gii.from_warehouse_code is not null
        and gii.base_qty > 0
      group by
        gii.item_code,
        gii.from_warehouse_code,
        gii.batch_number
    ),
    on_hand as (
      select
        ip.item_code,
        ip.warehouse_code,
        ip.ref as batch_number,
        sum(
          case
            when ip.transfer_type = 'OUT' then -ip.qty
            else ip.qty
          end
        ) as qty
      from public.inventory_postings ip
      group by
        ip.item_code,
        ip.warehouse_code,
        ip.ref
    )
    select 1
    from issue_qty iq
    left join on_hand oh
      on oh.item_code = iq.item_code
     and oh.warehouse_code = iq.warehouse_code
     and oh.batch_number is not distinct from iq.batch_number
    where iq.required_qty > coalesce(oh.qty, 0)
  ) then
    raise exception 'Goods issue quantity exceeds on-hand inventory.';
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
    'GOODS_ISSUE',
    new.id,
    gii.item_code,
    gii.from_warehouse_code,
    'MAIN SUB BIN',
    sum(gii.base_qty),
    coalesce(new.updated_by, new.created_by),
    'batch_code',
    gii.batch_number,
    'OUT',
    null,
    null
  from public.goods_issue_items gii
  where gii.goods_issue_id = new.id
    and gii.void = '1'
    and gii.item_code is not null
    and gii.from_warehouse_code is not null
    and gii.base_qty > 0
  group by
    gii.item_code,
    gii.from_warehouse_code,
    gii.batch_number;

  return new;
end;
$$;

drop trigger if exists post_goods_issue_inventory_trigger
  on public.goods_issue;

create trigger post_goods_issue_inventory_trigger
after update of status
on public.goods_issue
for each row
when (
  new.status = 'Posted'
  and old.status is distinct from 'Posted'
)
execute function public.post_goods_issue_inventory();
