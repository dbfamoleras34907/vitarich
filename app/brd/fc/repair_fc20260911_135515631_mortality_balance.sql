begin;

alter table public.inventory_postings
  add column if not exists reverses_posting_id bigint;

do $$
declare
  v_source_count integer;
  v_source_qty numeric;
  v_repair_count integer;
  v_repair_qty numeric;
begin
  -- These seven postings remained OUT after the Growing reversal. Their total
  -- is 325 birds. Use one reversal per source posting so the repair remains
  -- auditable and the existing reversal lookup can recognize each source.
  with expected(line_id, source_docentry, repair_docentry, expected_qty) as (
    values
      (309::bigint, 309001001::bigint, 309600001::bigint, 65::numeric),
      (312::bigint, 312001001::bigint, 312600001::bigint, 45::numeric),
      (313::bigint, 313001001::bigint, 313600001::bigint, 40::numeric),
      (317::bigint, 317001001::bigint, 317600001::bigint, 39::numeric),
      (319::bigint, 319001001::bigint, 319600001::bigint, 47::numeric),
      (325::bigint, 325001001::bigint, 325600001::bigint, 38::numeric),
      (327::bigint, 327001001::bigint, 327600001::bigint, 51::numeric)
  )
  select count(*), coalesce(sum(posting.qty), 0)
  into v_source_count, v_source_qty
  from expected
  join public.inventory_postings posting
    on posting.source_doc_type = 'BRD_FC_MORT_THIN_TRANSFER_OUT'
   and posting.source_docentry = expected.source_docentry
   and posting.item_code = 'DOC00002'
   and posting.warehouse_code = 'BD-0000021'
   and posting.ref = 'DOC:F65:B134:1'
   and posting.transfer_type = 'OUT'
   and posting.qty = expected.expected_qty;

  if v_source_count <> 7 or v_source_qty <> 325 then
    raise exception
      'Repair aborted: expected 7 stale Growing OUT postings totaling 325, found % totaling %.',
      v_source_count,
      v_source_qty;
  end if;

  with expected(source_docentry, repair_docentry, expected_qty) as (
    values
      (309001001::bigint, 309600001::bigint, 65::numeric),
      (312001001::bigint, 312600001::bigint, 45::numeric),
      (313001001::bigint, 313600001::bigint, 40::numeric),
      (317001001::bigint, 317600001::bigint, 39::numeric),
      (319001001::bigint, 319600001::bigint, 47::numeric),
      (325001001::bigint, 325600001::bigint, 38::numeric),
      (327001001::bigint, 327600001::bigint, 51::numeric)
  )
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
    reverses_posting_id
  )
  select
    'BRD_FC_MORT_THIN_REVERSAL',
    expected.repair_docentry,
    source_posting.item_code,
    source_posting.warehouse_code,
    coalesce(source_posting.bin_code, 'DEFAULT'),
    source_posting.qty,
    coalesce(auth.uid(), source_posting.created_by),
    coalesce(source_posting.ref_type, 'batch_code'),
    source_posting.ref,
    'IN',
    coalesce(source_posting.ref_type2, 'FLOCK_CARD'),
    source_posting.ref2,
    source_posting.id
  from expected
  join public.inventory_postings source_posting
    on source_posting.source_doc_type = 'BRD_FC_MORT_THIN_TRANSFER_OUT'
   and source_posting.source_docentry = expected.source_docentry
   and source_posting.item_code = 'DOC00002'
   and source_posting.warehouse_code = 'BD-0000021'
   and source_posting.ref = 'DOC:F65:B134:1'
   and source_posting.transfer_type = 'OUT'
   and source_posting.qty = expected.expected_qty
  where not exists (
    select 1
    from public.inventory_postings repair_posting
    where repair_posting.source_doc_type = 'BRD_FC_MORT_THIN_REVERSAL'
      and repair_posting.source_docentry = expected.repair_docentry
  );

  with expected(source_docentry, repair_docentry, expected_qty) as (
    values
      (309001001::bigint, 309600001::bigint, 65::numeric),
      (312001001::bigint, 312600001::bigint, 45::numeric),
      (313001001::bigint, 313600001::bigint, 40::numeric),
      (317001001::bigint, 317600001::bigint, 39::numeric),
      (319001001::bigint, 319600001::bigint, 47::numeric),
      (325001001::bigint, 325600001::bigint, 38::numeric),
      (327001001::bigint, 327600001::bigint, 51::numeric)
  )
  select count(*), coalesce(sum(repair_posting.qty), 0)
  into v_repair_count, v_repair_qty
  from expected
  join public.inventory_postings repair_posting
    on repair_posting.source_doc_type = 'BRD_FC_MORT_THIN_REVERSAL'
   and repair_posting.source_docentry = expected.repair_docentry
   and repair_posting.item_code = 'DOC00002'
   and repair_posting.warehouse_code = 'BD-0000021'
   and repair_posting.ref = 'DOC:F65:B134:1'
   and repair_posting.transfer_type = 'IN'
   and repair_posting.qty = expected.expected_qty
  join public.inventory_postings source_posting
    on source_posting.id = repair_posting.reverses_posting_id
   and source_posting.source_doc_type = 'BRD_FC_MORT_THIN_TRANSFER_OUT'
   and source_posting.source_docentry = expected.source_docentry;

  if v_repair_count <> 7 or v_repair_qty <> 325 then
    raise exception
      'Repair validation failed: expected 7 Growing IN reversals totaling 325, found % totaling %.',
      v_repair_count,
      v_repair_qty;
  end if;
end;
$$;

-- Expected immediately after this point-in-time repair:
-- batch_on_hand = 68,291 and net_growing_mortality = 3,483.
select
  coalesce(sum(
    case when posting.transfer_type = 'IN' then posting.qty else -posting.qty end
  ), 0) as batch_on_hand,
  -coalesce(sum(
    case
      when posting.source_doc_type in (
        'BRD_FC_MORT_THIN_USAGE',
        'BRD_FC_MORT_THIN_TRANSFER_OUT',
        'BRD_FC_MORT_THIN_REVERSAL'
      )
        then case when posting.transfer_type = 'IN' then posting.qty else -posting.qty end
      else 0
    end
  ), 0) as net_growing_mortality
from public.inventory_postings posting
where posting.item_code = 'DOC00002'
  and posting.warehouse_code = 'BD-0000021'
  and posting.ref = 'DOC:F65:B134:1';

commit;
