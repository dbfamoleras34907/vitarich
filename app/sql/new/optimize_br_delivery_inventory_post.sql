-- Avoid aggregating all inventory history when posting one Harvest & Delivery.
-- The save RPC already serializes delivery inventory posting with an advisory
-- transaction lock, so the targeted balance lookup preserves the existing
-- concurrency contract while allowing the current composite index to be used.
begin;

create or replace function public.post_br_delivery_inventory()
returns trigger
language plpgsql
as $$
begin
  if new.status <> 'Posted' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'Posted' then
    return new;
  end if;

  if exists (
    with issue_qty as (
      select
        line.item_code,
        line.from_warehouse_code as warehouse_code,
        line.batch_number,
        sum(line.base_qty) as required_qty
      from public.br_delivery_lines line
      where line.br_delivery_id = new.id
        and line.void = '1'
        and line.item_code is not null
        and line.from_warehouse_code is not null
        and line.base_qty > 0
      group by line.item_code, line.from_warehouse_code, line.batch_number
    )
    select 1
    from issue_qty required
    where required.required_qty > coalesce((
      select sum(
        case when posting.transfer_type = 'OUT' then -posting.qty else posting.qty end
      )
      from public.inventory_postings posting
      where posting.item_code = required.item_code
        and posting.warehouse_code = required.warehouse_code
        and coalesce(posting.batch_number, posting.ref)
          is not distinct from required.batch_number
    ), 0)
  ) then
    raise exception 'Broiler delivery quantity exceeds on-hand inventory.';
  end if;

  insert into public.inventory_postings (
    source_doc_type, source_docentry, item_code, warehouse_code, bin_code, batch_number,
    qty, created_by, ref_type, ref, transfer_type, ref_type2, ref2
  )
  select
    'BR_DELIVERY',
    new.id,
    line.item_code,
    line.from_warehouse_code,
    'MAIN SUB BIN',
    line.batch_number,
    sum(line.base_qty),
    coalesce(new.updated_by, new.created_by),
    'batch_code',
    line.batch_number,
    'OUT',
    null,
    null
  from public.br_delivery_lines line
  where line.br_delivery_id = new.id
    and line.void = '1'
    and line.item_code is not null
    and line.from_warehouse_code is not null
    and line.base_qty > 0
  group by line.item_code, line.from_warehouse_code, line.batch_number;

  return new;
end;
$$;

commit;
