alter table public.goods_receipt_items
  add column if not exists doc_line_no integer null;

create index if not exists goods_receipt_items_doc_line_no_idx
  on public.goods_receipt_items (goods_reciept_id, doc_line_no);

alter table public.inventory_postings
  add column if not exists batch_number text null;

create or replace function public.post_goods_receipt_inventory()
returns trigger
language plpgsql
as $$
declare
  is_doc_receiving boolean;
  existing_posting_count integer;
  posting_contract_mismatch boolean;
begin
  if new.status <> 'Posted' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.status = 'Posted' then
    return new;
  end if;

  select exists (
    select 1
    from public.goods_receipt_doc grd
    where grd.goods_reciept_id = new.id
      and grd.void = '1'
  )
  into is_doc_receiving;

  if is_doc_receiving then
    if new.farm_id is null then
      raise exception 'DOC Receiving % cannot post without a farm', new.gr_no;
    end if;

    if exists (
      select 1
      from public.goods_receipt_items gri
      left join public.goods_receipt_doc grd
        on grd.goods_reciept_id = gri.goods_reciept_id
       and grd.line_no = gri.doc_line_no
       and grd.void = '1'
      left join public.flock_card fc
        on fc.id = grd.flock_card_id
       and fc.void = '1'
       and fc.status = 'Saved'
      left join public.i_warehouse iw
        on iw.id = gri.warehouse_id
      where gri.goods_reciept_id = new.id
        and gri.void = '1'
        and gri.base_qty > 0
        and (
          gri.doc_line_no is null
          or grd.id is null
          or grd.building_warehouse_id is null
          or grd.flock_card_id is null
          or fc.id is null
          or fc.farm_id is distinct from new.farm_id
          or fc.building_whse_id is distinct from grd.building_warehouse_id
          or nullif(trim(fc.cycle_no), '') is null
          or iw.id is null
          or nullif(trim(gri.warehouse_code), '') is distinct from nullif(trim(iw.whse_code), '')
          or nullif(trim(gri.batch_number), '') is null
        )
    ) then
      raise exception 'DOC Receiving % has an incomplete item, building, flock-card, cycle, warehouse, or batch link', new.gr_no;
    end if;

    select count(*)
    into existing_posting_count
    from public.inventory_postings ip
    where ip.source_docentry = new.id
      and ip.source_doc_type in (
        'GOODS_RECEIPT',
        'DOC_RECEIVING_CONSOLIDATION',
        'DOC_RECEIVING_AUTO_USAGE'
      );

    if existing_posting_count > 0 then
      with expected as (
        select
          'GOODS_RECEIPT'::text as source_doc_type,
          'IN'::text as transfer_type,
          gri.item_code,
          iw.whse_code as warehouse_code,
          gri.batch_number,
          sum(gri.base_qty)::numeric as qty
        from public.goods_receipt_items gri
        join public.goods_receipt_doc grd
          on grd.goods_reciept_id = gri.goods_reciept_id
         and grd.line_no = gri.doc_line_no
         and grd.void = '1'
        join public.i_warehouse iw
          on iw.id = gri.warehouse_id
        where gri.goods_reciept_id = new.id
          and gri.void = '1'
          and gri.base_qty > 0
        group by gri.item_code, iw.whse_code, gri.batch_number

        union all

        select
          'DOC_RECEIVING_CONSOLIDATION'::text,
          'OUT'::text,
          gri.item_code,
          iw.whse_code,
          gri.batch_number,
          sum(gri.base_qty)::numeric
        from public.goods_receipt_items gri
        join public.goods_receipt_doc grd
          on grd.goods_reciept_id = gri.goods_reciept_id
         and grd.line_no = gri.doc_line_no
         and grd.void = '1'
        join public.i_warehouse iw
          on iw.id = gri.warehouse_id
        where gri.goods_reciept_id = new.id
          and gri.void = '1'
          and gri.base_qty > 0
          and gri.warehouse_id = grd.building_warehouse_id
        group by gri.item_code, iw.whse_code, gri.batch_number

        union all

        select
          'DOC_RECEIVING_CONSOLIDATION'::text,
          'IN'::text,
          gri.item_code,
          iw.whse_code,
          format('DOC:F%s:B%s:%s', new.farm_id, grd.building_warehouse_id, trim(fc.cycle_no)),
          sum(gri.base_qty)::numeric
        from public.goods_receipt_items gri
        join public.goods_receipt_doc grd
          on grd.goods_reciept_id = gri.goods_reciept_id
         and grd.line_no = gri.doc_line_no
         and grd.void = '1'
        join public.flock_card fc
          on fc.id = grd.flock_card_id
         and fc.void = '1'
         and fc.status = 'Saved'
        join public.i_warehouse iw
          on iw.id = gri.warehouse_id
        where gri.goods_reciept_id = new.id
          and gri.void = '1'
          and gri.base_qty > 0
          and gri.warehouse_id = grd.building_warehouse_id
        group by
          gri.item_code,
          iw.whse_code,
          grd.building_warehouse_id,
          trim(fc.cycle_no)

        union all

        select
          'DOC_RECEIVING_AUTO_USAGE'::text,
          'OUT'::text,
          gri.item_code,
          iw.whse_code,
          gri.batch_number,
          sum(gri.base_qty)::numeric
        from public.goods_receipt_items gri
        join public.goods_receipt_doc grd
          on grd.goods_reciept_id = gri.goods_reciept_id
         and grd.line_no = gri.doc_line_no
         and grd.void = '1'
        join public.i_warehouse iw
          on iw.id = gri.warehouse_id
        where gri.goods_reciept_id = new.id
          and gri.void = '1'
          and gri.base_qty > 0
          and gri.warehouse_id is distinct from grd.building_warehouse_id
        group by gri.item_code, iw.whse_code, gri.batch_number
      ),
      actual as (
        select
          ip.source_doc_type,
          ip.transfer_type,
          ip.item_code,
          ip.warehouse_code,
          coalesce(nullif(trim(ip.batch_number), ''), nullif(trim(ip.ref), '')) as batch_number,
          sum(ip.qty)::numeric as qty
        from public.inventory_postings ip
        where ip.source_docentry = new.id
          and ip.source_doc_type in (
            'GOODS_RECEIPT',
            'DOC_RECEIVING_CONSOLIDATION',
            'DOC_RECEIVING_AUTO_USAGE'
          )
        group by
          ip.source_doc_type,
          ip.transfer_type,
          ip.item_code,
          ip.warehouse_code,
          coalesce(nullif(trim(ip.batch_number), ''), nullif(trim(ip.ref), ''))
      ),
      differences as (
        (select * from expected except all select * from actual)
        union all
        (select * from actual except all select * from expected)
      )
      select exists (select 1 from differences)
      into posting_contract_mismatch;

      if posting_contract_mismatch then
        raise exception 'DOC Receiving % has partial or conflicting inventory postings; posting was stopped', new.gr_no;
      end if;

      return new;
    end if;
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
    ref2,
    batch_number
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
    null,
    gri.batch_number
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

  if is_doc_receiving then
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
      ref2,
      batch_number
    )
    select
      'DOC_RECEIVING_CONSOLIDATION',
      new.id,
      gri.item_code,
      iw.whse_code,
      'MAIN SUB BIN',
      sum(gri.base_qty),
      coalesce(new.updated_by, new.created_by),
      'BATCH_CODE',
      gri.batch_number,
      'OUT',
      'CONSOLIDATED_BATCH',
      format('DOC:F%s:B%s:%s', new.farm_id, grd.building_warehouse_id, trim(fc.cycle_no)),
      gri.batch_number
    from public.goods_receipt_items gri
    join public.goods_receipt_doc grd
      on grd.goods_reciept_id = gri.goods_reciept_id
     and grd.line_no = gri.doc_line_no
     and grd.void = '1'
    join public.flock_card fc
      on fc.id = grd.flock_card_id
     and fc.void = '1'
     and fc.status = 'Saved'
    join public.i_warehouse iw
      on iw.id = gri.warehouse_id
    where gri.goods_reciept_id = new.id
      and gri.void = '1'
      and gri.base_qty > 0
      and gri.warehouse_id = grd.building_warehouse_id
    group by
      gri.item_code,
      iw.whse_code,
      gri.batch_number,
      grd.building_warehouse_id,
      trim(fc.cycle_no);

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
      ref2,
      batch_number
    )
    select
      'DOC_RECEIVING_CONSOLIDATION',
      new.id,
      gri.item_code,
      iw.whse_code,
      'MAIN SUB BIN',
      sum(gri.base_qty),
      coalesce(new.updated_by, new.created_by),
      'BATCH_CODE',
      format('DOC:F%s:B%s:%s', new.farm_id, grd.building_warehouse_id, trim(fc.cycle_no)),
      'IN',
      null,
      null,
      format('DOC:F%s:B%s:%s', new.farm_id, grd.building_warehouse_id, trim(fc.cycle_no))
    from public.goods_receipt_items gri
    join public.goods_receipt_doc grd
      on grd.goods_reciept_id = gri.goods_reciept_id
     and grd.line_no = gri.doc_line_no
     and grd.void = '1'
    join public.flock_card fc
      on fc.id = grd.flock_card_id
     and fc.void = '1'
     and fc.status = 'Saved'
    join public.i_warehouse iw
      on iw.id = gri.warehouse_id
    where gri.goods_reciept_id = new.id
      and gri.void = '1'
      and gri.base_qty > 0
      and gri.warehouse_id = grd.building_warehouse_id
    group by
      gri.item_code,
      iw.whse_code,
      grd.building_warehouse_id,
      trim(fc.cycle_no);

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
      ref2,
      batch_number
    )
    select
      'DOC_RECEIVING_AUTO_USAGE',
      new.id,
      gri.item_code,
      iw.whse_code,
      'MAIN SUB BIN',
      sum(gri.base_qty),
      coalesce(new.updated_by, new.created_by),
      'BATCH_CODE',
      gri.batch_number,
      'OUT',
      'AUTO_USAGE',
      'BAD_DOC',
      gri.batch_number
    from public.goods_receipt_items gri
    join public.goods_receipt_doc grd
      on grd.goods_reciept_id = gri.goods_reciept_id
     and grd.line_no = gri.doc_line_no
     and grd.void = '1'
    join public.i_warehouse iw
      on iw.id = gri.warehouse_id
    where gri.goods_reciept_id = new.id
      and gri.void = '1'
      and gri.base_qty > 0
      and gri.warehouse_id is distinct from grd.building_warehouse_id
    group by gri.item_code, iw.whse_code, gri.batch_number;
  end if;

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
