-- Apply after goods_reciept_tables.sql, gr_inventory_postings.sql, and
-- receiving_sources.sql. This is the authoritative DOC Placement Reverse path.

alter table public.goods_receipt
  drop constraint if exists goods_reciept_status_check;

alter table public.goods_receipt
  add constraint goods_reciept_status_check
  check (status in ('Draft', 'Posted', 'Reversed', 'Cancelled'));

alter table public.inventory_postings
  add column if not exists doc_receiving_reverses_posting_id bigint null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_postings_doc_receiving_reversal_fk'
      and conrelid = 'public.inventory_postings'::regclass
  ) then
    alter table public.inventory_postings
      add constraint inventory_postings_doc_receiving_reversal_fk
      foreign key (doc_receiving_reverses_posting_id)
      references public.inventory_postings(id);
  end if;
end;
$$;

create unique index if not exists inventory_postings_one_doc_receiving_reversal_idx
  on public.inventory_postings(doc_receiving_reverses_posting_id)
  where doc_receiving_reverses_posting_id is not null;

create or replace function public.validate_doc_receiving_reversal_link()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_source public.inventory_postings%rowtype;
begin
  if new.doc_receiving_reverses_posting_id is null then
    return new;
  end if;

  if new.source_doc_type <> 'DOC_RECEIVING_REVERSAL' then
    raise exception 'Only a DOC Placement reversal may reference a reversed posting.';
  end if;

  select * into v_source
  from public.inventory_postings
  where id = new.doc_receiving_reverses_posting_id;

  if not found
     or not (
       (v_source.source_doc_type = 'DOC_RECEIVING_CONSOLIDATION'
        and v_source.transfer_type = 'IN'
        and new.transfer_type = 'OUT')
       or (v_source.source_doc_type = 'DOC_RECEIVING_AUTO_USAGE'
           and v_source.transfer_type = 'OUT'
           and new.transfer_type = 'IN')
       or (v_source.source_doc_type = 'GOODS_RECEIPT'
           and v_source.transfer_type = 'IN'
           and new.transfer_type = 'OUT')
     )
     or new.source_docentry is distinct from v_source.source_docentry
     or new.item_code is distinct from v_source.item_code
     or new.warehouse_code is distinct from v_source.warehouse_code
     or new.bin_code is distinct from v_source.bin_code
     or new.qty is distinct from v_source.qty
     or new.ref_type is distinct from v_source.ref_type
     or new.ref is distinct from v_source.ref
     or new.ref_type2 is distinct from v_source.ref_type2
     or new.ref2 is distinct from v_source.ref2
     or new.batch_number is distinct from v_source.batch_number
     then
    raise exception 'DOC Placement reversal does not match source posting %.', new.doc_receiving_reverses_posting_id;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_doc_receiving_reversal_link on public.inventory_postings;
create trigger validate_doc_receiving_reversal_link
before insert or update of source_doc_type, doc_receiving_reverses_posting_id,
  source_docentry, item_code, warehouse_code, bin_code, qty, ref_type, ref,
  transfer_type, ref_type2, ref2, batch_number
on public.inventory_postings
for each row
execute function public.validate_doc_receiving_reversal_link();

create or replace function public.reverse_doc_receiving(p_receipt_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_receipt public.goods_receipt%rowtype;
  v_posting_count integer;
begin
  if p_receipt_id is null then
    raise exception 'A DOC Placement is required.';
  end if;

  select * into v_receipt
  from public.goods_receipt
  where id = p_receipt_id
  for update;

  if not found then
    raise exception 'DOC Placement was not found.';
  end if;

  perform public.require_receiving_source_access('broiler', v_receipt.farm_id, 'void');

  if v_receipt.status <> 'Posted' then
    raise exception 'Only a Posted DOC Placement can be reversed.';
  end if;

  -- Growing operates on the canonical consolidated DOC:F... batch. The
  -- original receipt batch is only the source side of the consolidation and
  -- must not be used as the Growing reversal blocker.
  if exists (
    with doc_batches as (
      select distinct format('DOC:F%s:B%s:%s', v_receipt.farm_id, d.building_warehouse_id, btrim(fc.cycle_no)) as batch_number
      from public.goods_receipt_doc d
      join public.flock_card fc on fc.id = d.flock_card_id
      where d.goods_reciept_id = p_receipt_id
        and d.void = '1'
        and d.building_warehouse_id is not null
        and nullif(btrim(fc.cycle_no), '') is not null
    )
    select 1
    from public.inventory_postings ip
    join doc_batches b on ip.batch_number = b.batch_number
       or ip.ref = b.batch_number
       or ip.ref2 = b.batch_number
    where ip.source_doc_type like 'BRD_FC%'
  ) then
    raise exception 'DOC Placement cannot be reversed because its consolidated batch is already used in Growing inventory.';
  end if;

  -- Reverse the consolidated DOC batch, plus the paired reject/disposal
  -- receipt and auto-usage postings. Good-DOC source receipt and source-batch
  -- consolidation OUT already net to zero and remain unchanged.
  select count(*) into v_posting_count
  from public.inventory_postings
  where source_docentry = p_receipt_id
    and (
      (source_doc_type = 'DOC_RECEIVING_CONSOLIDATION'
       and transfer_type = 'IN'
       and batch_number like 'DOC:F%')
      or (source_doc_type = 'DOC_RECEIVING_AUTO_USAGE' and transfer_type = 'OUT')
      or (source_doc_type = 'GOODS_RECEIPT'
          and transfer_type = 'IN'
          and exists (
            select 1
            from public.inventory_postings auto_usage
            where auto_usage.source_docentry = public.inventory_postings.source_docentry
              and auto_usage.source_doc_type = 'DOC_RECEIVING_AUTO_USAGE'
              and auto_usage.transfer_type = 'OUT'
              and auto_usage.item_code is not distinct from public.inventory_postings.item_code
              and auto_usage.warehouse_code is not distinct from public.inventory_postings.warehouse_code
              and auto_usage.batch_number is not distinct from public.inventory_postings.batch_number
              and auto_usage.ref is not distinct from public.inventory_postings.ref
          ))
    );

  if v_posting_count = 0 then
    raise exception 'DOC Placement has no consolidated batch inventory posting to reverse.';
  end if;

  insert into public.inventory_postings (
    source_doc_type, source_docentry, item_code, warehouse_code, bin_code, qty,
    created_by, ref_type, ref, transfer_type, ref_type2, ref2, batch_number,
    doc_receiving_reverses_posting_id
  )
  select
    'DOC_RECEIVING_REVERSAL', source_docentry, item_code, warehouse_code, bin_code, qty,
    auth.uid(), ref_type, ref,
    'OUT',
    ref_type2, ref2, batch_number, id
  from public.inventory_postings
  where source_docentry = p_receipt_id
    and source_doc_type = 'DOC_RECEIVING_CONSOLIDATION'
    and transfer_type = 'IN'
    and batch_number like 'DOC:F%'
  union all
  select
    'DOC_RECEIVING_REVERSAL', source_docentry, item_code, warehouse_code, bin_code, qty,
    auth.uid(), ref_type, ref, 'IN', ref_type2, ref2, batch_number, id
  from public.inventory_postings
  where source_docentry = p_receipt_id
    and source_doc_type = 'DOC_RECEIVING_AUTO_USAGE'
    and transfer_type = 'OUT'
  union all
  select
    'DOC_RECEIVING_REVERSAL', source_docentry, item_code, warehouse_code, bin_code, qty,
    auth.uid(), ref_type, ref, 'OUT', ref_type2, ref2, batch_number, id
  from public.inventory_postings receipt_posting
  where receipt_posting.source_docentry = p_receipt_id
    and receipt_posting.source_doc_type = 'GOODS_RECEIPT'
    and receipt_posting.transfer_type = 'IN'
    and exists (
      select 1
      from public.inventory_postings auto_usage
      where auto_usage.source_docentry = receipt_posting.source_docentry
        and auto_usage.source_doc_type = 'DOC_RECEIVING_AUTO_USAGE'
        and auto_usage.transfer_type = 'OUT'
        and auto_usage.item_code is not distinct from receipt_posting.item_code
        and auto_usage.warehouse_code is not distinct from receipt_posting.warehouse_code
        and auto_usage.batch_number is not distinct from receipt_posting.batch_number
        and auto_usage.ref is not distinct from receipt_posting.ref
    );

  update public.goods_receipt
  set status = 'Reversed', updated_by = auth.uid(), updated_at = now()
  where id = p_receipt_id and status = 'Posted';
end;
$$;

-- Reversed is the DOC Placement Void action for the existing centralized
-- receiving-flow event capture. Keep the event authoritative and transactional.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.capture_receiving_flow_event()'::regprocedure)
    into v_definition;
  if position('v_posted:=v_header->>''status'' in (''Posted'',''Received''); v_active:=v_header->>''status''<>''Cancelled'';' in v_definition) = 0
     and position('v_posted:=v_header->>''status'' in (''Posted'',''Received''); v_active:=v_header->>''status'' not in (''Cancelled'',''Reversed'');' in v_definition) = 0 then
    raise exception 'DOC receiving notification function shape was not recognized; apply the notification migration first.';
  end if;
  v_definition := replace(
    v_definition,
    'v_posted:=v_header->>''status'' in (''Posted'',''Received''); v_active:=v_header->>''status''<>''Cancelled'';',
    'v_posted:=v_header->>''status'' in (''Posted'',''Received''); v_active:=v_header->>''status'' not in (''Cancelled'',''Reversed'');'
  );
  execute v_definition;
end;
$$;

revoke all on function public.reverse_doc_receiving(bigint) from public, anon;
grant execute on function public.reverse_doc_receiving(bigint) to authenticated;

notify pgrst, 'reload schema';
