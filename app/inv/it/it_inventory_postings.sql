create or replace function public.post_inventory_transfer_inventory()
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
    with transfer_qty as (
      select
        iti.item_code,
        iti.from_warehouse_code as warehouse_code,
        iti.batch_number,
        sum(iti.base_qty) as required_qty
      from public.inventory_transfer_items iti
      where iti.inventory_transfer_id = new.id
        and iti.void = '1'
        and iti.item_code is not null
        and iti.from_warehouse_code is not null
        and iti.to_warehouse_code is not null
        and iti.base_qty > 0
      group by
        iti.item_code,
        iti.from_warehouse_code,
        iti.batch_number
    ),
    on_hand as (
      select
        ip.item_code,
        ip.warehouse_code,
        batch_ref.batch_number,
        sum(
          case
            when ip.transfer_type = 'OUT' then -ip.qty
            else ip.qty
          end
        ) as qty
      from public.inventory_postings ip
      cross join lateral (
        select distinct batch_number
        from (values (ip.ref), (ip.ref2)) as refs(batch_number)
        where batch_number is not null
          and btrim(batch_number) <> ''
      ) batch_ref
      group by
        ip.item_code,
        ip.warehouse_code,
        batch_ref.batch_number
    )
    select 1
    from transfer_qty tq
    left join on_hand oh
      on oh.item_code = tq.item_code
     and oh.warehouse_code = tq.warehouse_code
     and oh.batch_number is not distinct from tq.batch_number
    where tq.required_qty > coalesce(oh.qty, 0)
  ) then
    raise exception 'Inventory transfer quantity exceeds on-hand inventory.';
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
    'INVENTORY_TRANSFER',
    new.id,
    iti.item_code,
    movement.warehouse_code,
    'MAIN SUB BIN',
    sum(iti.base_qty),
    coalesce(new.updated_by, new.created_by),
    'batch_code',
    iti.batch_number,
    movement.transfer_type,
    'paired_warehouse',
    movement.paired_warehouse_code
  from public.inventory_transfer_items iti
  cross join lateral (
    values
      ('OUT'::text, iti.from_warehouse_code, iti.to_warehouse_code),
      ('IN'::text, iti.to_warehouse_code, iti.from_warehouse_code)
  ) as movement(transfer_type, warehouse_code, paired_warehouse_code)
  where iti.inventory_transfer_id = new.id
    and iti.void = '1'
    and iti.item_code is not null
    and iti.from_warehouse_code is not null
    and iti.to_warehouse_code is not null
    and iti.base_qty > 0
  group by
    iti.item_code,
    iti.batch_number,
    movement.transfer_type,
    movement.warehouse_code,
    movement.paired_warehouse_code;

  return new;
end;
$$;

drop trigger if exists post_inventory_transfer_inventory_trigger
  on public.inventory_transfer;

create trigger post_inventory_transfer_inventory_trigger
after update of status
on public.inventory_transfer
for each row
when (
  new.status = 'Posted'
  and old.status is distinct from 'Posted'
)
execute function public.post_inventory_transfer_inventory();
