-- Read-only preview for the proposed LEGACY / DTW DOC inventory closeout.
--
-- This statement does not create or post Goods Issues. It returns one proposed
-- Goods Issue line per farm + item + warehouse + batch with a positive ledger
-- balance. Review every row whose validation_status is not READY before any
-- write statement is prepared.
--
-- Qualifying origin:
--   1. DOC Placement source is LEGACY (detail source, with the historical
--      receipt-header source as fallback), or
--   2. the posted DOC Placement was created by DTW.

with dtw_receipt_provenance as (
  select
    imported.entity_id as goods_receipt_id,
    string_agg(distinct job.id::text, ', ' order by job.id::text) as dtw_job_ids,
    string_agg(distinct job.file_name, ', ' order by job.file_name) as dtw_source_files,
    string_agg(distinct job.mode, ', ' order by job.mode) as dtw_modes,
    string_agg(distinct job.status, ', ' order by job.status) as dtw_job_statuses,
    string_agg(distinct imported.row_no::text, ', ' order by imported.row_no::text) as dtw_doc_placement_rows,
    bool_or(job.status = 'Completed') as has_completed_dtw_job,
    bool_or(job.status <> 'Completed') as has_noncompleted_dtw_job
  from public.broiler_dtw_import_rows imported
  join public.broiler_dtw_import_jobs job
    on job.id = imported.job_id
  where imported.stage = 'DOC Placement'
    and imported.entity_id is not null
    and not exists (
      select 1
      from jsonb_array_elements_text(coalesce(imported.warnings, '[]'::jsonb)) warning(value)
      where warning.value like 'Skipped:%'
    )
  group by imported.entity_id
),
receipt_line_candidates as (
  select
    receipt.farm_id,
    farm.code as farm_code,
    farm.name as farm_name,
    receipt.id as goods_receipt_id,
    receipt.gr_no,
    receipt.receive_date,
    receipt_line.item_id,
    btrim(receipt_line.item_code) as item_code,
    receipt_line.description,
    receipt_line.batch_rule_id,
    btrim(receipt_line.batch_number) as batch_number,
    receipt_line.manufacturing_date,
    receipt_line.expiry_date,
    receipt_line.alt_uom,
    receipt_line.base_uom,
    receipt_line.warehouse_id,
    btrim(receipt_line.warehouse_code) as warehouse_code,
    receipt_line.warehouse_name,
    dtw.dtw_job_ids,
    dtw.dtw_source_files,
    dtw.dtw_modes,
    dtw.dtw_job_statuses,
    dtw.dtw_doc_placement_rows,
    dtw.has_completed_dtw_job,
    dtw.has_noncompleted_dtw_job,
    (
      dtw.goods_receipt_id is not null
      or receipt.gr_no ilike 'DTW-DOC-%'
      or exists (
        select 1
        from public.inventory_postings origin_posting
        where origin_posting.source_doc_type = 'GOODS_RECEIPT'
          and origin_posting.source_docentry = receipt.id
          and upper(btrim(coalesce(origin_posting.ref_type2, ''))) = 'BROILER_DTW'
      )
    ) as is_dtw,
    (
      exists (
        select 1
        from public.goods_receipt_doc doc_line
        where doc_line.goods_reciept_id = receipt.id
          and doc_line.void = '1'
          and (
            receipt_line.doc_line_no is null
            or doc_line.line_no = receipt_line.doc_line_no
          )
          and upper(
            btrim(
              coalesce(
                nullif(doc_line.doc_source, ''),
                nullif(receipt.vendor, ''),
                nullif(receipt.dr_reference, '')
              )
            )
          ) = 'LEGACY'
      )
    ) as is_legacy
  from public.goods_receipt receipt
  join public.goods_receipt_items receipt_line
    on receipt_line.goods_reciept_id = receipt.id
   and receipt_line.void = '1'
  left join public.farms farm
    on farm.id = receipt.farm_id
  left join dtw_receipt_provenance dtw
    on dtw.goods_receipt_id = receipt.id
  where receipt.status in ('Posted', 'Received')
    and nullif(btrim(receipt_line.item_code), '') is not null
    and nullif(btrim(receipt_line.warehouse_code), '') is not null
    and nullif(btrim(receipt_line.batch_number), '') is not null
),
qualifying_receipt_lines as (
  select *
  from receipt_line_candidates
  where is_legacy or coalesce(has_completed_dtw_job, false)
),
qualifying_batches as (
  select
    candidate.farm_id,
    min(candidate.farm_code) as farm_code,
    min(candidate.farm_name) as farm_name,
    min(candidate.item_id) as item_id,
    min(candidate.item_code) as item_code,
    min(candidate.description) as item_description,
    min(candidate.batch_rule_id) as batch_rule_id,
    min(candidate.batch_number) as batch_number,
    min(candidate.manufacturing_date) as manufacturing_date,
    min(candidate.expiry_date) as expiry_date,
    min(candidate.alt_uom) as alt_uom,
    min(candidate.base_uom) as base_uom,
    min(candidate.warehouse_id) as warehouse_id,
    min(candidate.warehouse_code) as warehouse_code,
    min(candidate.warehouse_name) as warehouse_name,
    bool_or(candidate.is_legacy) as has_legacy_origin,
    bool_or(candidate.is_dtw) as has_dtw_origin,
    bool_or(candidate.is_dtw and candidate.dtw_job_ids is not null) as has_verified_dtw_job,
    bool_or(candidate.is_dtw and candidate.dtw_job_ids is null) as has_unlinked_dtw_marker,
    bool_or(candidate.is_dtw and coalesce(candidate.has_completed_dtw_job, false)) as has_completed_dtw_job,
    bool_or(candidate.is_dtw and coalesce(candidate.has_noncompleted_dtw_job, false)) as has_noncompleted_dtw_job,
    count(distinct candidate.item_id) as item_id_count,
    count(distinct candidate.warehouse_id) as warehouse_id_count,
    count(distinct candidate.alt_uom) as alt_uom_count,
    count(distinct candidate.base_uom) as base_uom_count,
    count(distinct candidate.goods_receipt_id) as source_receipt_count,
    string_agg(distinct candidate.gr_no, ', ' order by candidate.gr_no) as source_doc_placement_nos,
    string_agg(distinct candidate.dtw_job_ids, ', ' order by candidate.dtw_job_ids)
      filter (where candidate.dtw_job_ids is not null) as dtw_job_ids,
    string_agg(distinct candidate.dtw_source_files, ', ' order by candidate.dtw_source_files)
      filter (where candidate.dtw_source_files is not null) as dtw_source_files,
    string_agg(distinct candidate.dtw_modes, ', ' order by candidate.dtw_modes)
      filter (where candidate.dtw_modes is not null) as dtw_modes,
    string_agg(distinct candidate.dtw_job_statuses, ', ' order by candidate.dtw_job_statuses)
      filter (where candidate.dtw_job_statuses is not null) as dtw_job_statuses,
    string_agg(distinct candidate.dtw_doc_placement_rows, ', ' order by candidate.dtw_doc_placement_rows)
      filter (where candidate.dtw_doc_placement_rows is not null) as dtw_doc_placement_rows,
    min(candidate.receive_date) as first_receive_date,
    max(candidate.receive_date) as last_receive_date
  from qualifying_receipt_lines candidate
  group by
    candidate.farm_id,
    upper(candidate.item_code),
    upper(candidate.warehouse_code),
    upper(candidate.batch_number)
),
ledger_balances as (
  select
    upper(btrim(posting.item_code)) as item_key,
    upper(btrim(posting.warehouse_code)) as warehouse_key,
    upper(btrim(coalesce(posting.batch_number, posting.ref))) as batch_key,
    sum(
      case
        when upper(btrim(coalesce(posting.transfer_type, ''))) = 'OUT'
          then -posting.qty
        else posting.qty
      end
    )::numeric as remaining_qty
  from public.inventory_postings posting
  where nullif(btrim(posting.item_code), '') is not null
    and nullif(btrim(posting.warehouse_code), '') is not null
    and nullif(btrim(coalesce(posting.batch_number, posting.ref)), '') is not null
  group by
    upper(btrim(posting.item_code)),
    upper(btrim(posting.warehouse_code)),
    upper(btrim(coalesce(posting.batch_number, posting.ref)))
),
preview as (
  select
    batch.farm_id,
    batch.farm_code,
    batch.farm_name,
    batch.item_id,
    batch.item_code,
    batch.item_description,
    batch.batch_rule_id,
    batch.batch_number,
    batch.manufacturing_date,
    batch.expiry_date,
    batch.alt_uom,
    batch.base_uom,
    batch.warehouse_id,
    batch.warehouse_code,
    batch.warehouse_name,
    warehouse.farm_id as warehouse_farm_id,
    balance.remaining_qty,
    case
      when batch.has_dtw_origin and batch.has_legacy_origin then 'DTW + LEGACY'
      when batch.has_dtw_origin then 'DTW'
      else 'LEGACY'
    end as qualifying_origin,
    case
      when batch.has_completed_dtw_job then concat_ws(
        ' | ',
        'DTW import',
        'Job: ' || batch.dtw_job_ids,
        'File: ' || batch.dtw_source_files,
        'Mode: ' || batch.dtw_modes,
        'Status: ' || batch.dtw_job_statuses,
        'DOC Placement row: ' || batch.dtw_doc_placement_rows,
        'Receipt: ' || batch.source_doc_placement_nos
      )
      when batch.has_verified_dtw_job then concat_ws(
        ' | ',
        'DTW import job requires review',
        'Job: ' || batch.dtw_job_ids,
        'File: ' || batch.dtw_source_files,
        'Status: ' || batch.dtw_job_statuses,
        'Receipt: ' || batch.source_doc_placement_nos
      )
      when batch.has_dtw_origin then 'DTW marker only | Receipt: ' || batch.source_doc_placement_nos
      else 'LEGACY DOC source | Receipt: ' || batch.source_doc_placement_nos
    end as source,
    case
      when batch.has_completed_dtw_job
        and (batch.has_noncompleted_dtw_job or batch.has_unlinked_dtw_marker)
        then 'PARTIAL: completed DTW job verified; another source still requires review'
      when batch.has_completed_dtw_job
        then 'VERIFIED: linked to a completed, non-skipped DTW DOC Placement import row'
      when batch.has_verified_dtw_job
        then 'REVIEW: linked DTW import job is not Completed'
      when batch.has_unlinked_dtw_marker
        then 'REVIEW: DTW receipt/ledger marker found, but no import-row link'
      else 'NOT DTW: qualified by LEGACY DOC source only'
    end as dtw_verification,
    batch.dtw_job_ids,
    batch.dtw_source_files,
    batch.dtw_modes,
    batch.dtw_job_statuses,
    batch.dtw_doc_placement_rows,
    batch.source_receipt_count,
    batch.source_doc_placement_nos,
    batch.first_receive_date,
    batch.last_receive_date,
    case
      when batch.farm_id is null then 'BLOCKED: DOC Placement has no farm_id'
      when batch.warehouse_id is null then 'BLOCKED: receipt line has no warehouse_id'
      when warehouse.id is null then 'BLOCKED: warehouse_id does not exist'
      when warehouse.farm_id is distinct from batch.farm_id then 'BLOCKED: warehouse farm does not match DOC Placement farm'
      when batch.item_id is null then 'BLOCKED: receipt line has no item_id'
      when batch.item_id_count <> 1 then 'BLOCKED: batch resolves to multiple item IDs'
      when batch.warehouse_id_count <> 1 then 'BLOCKED: batch resolves to multiple warehouse IDs'
      when batch.alt_uom_count <> 1 or nullif(btrim(batch.alt_uom), '') is null
        then 'BLOCKED: batch does not resolve to one alternate UOM'
      when batch.base_uom_count <> 1 or nullif(btrim(batch.base_uom), '') is null
        then 'BLOCKED: batch does not resolve to one base UOM'
      when upper(btrim(batch.alt_uom)) <> upper(btrim(batch.base_uom))
        then 'BLOCKED: alternate/base UOM conversion is required'
      when not exists (
        select 1
        from public.items item
        where item.id = batch.item_id
          and upper(btrim(item.item_code)) = upper(batch.item_code)
      ) then 'BLOCKED: item_id does not match item_code'
      else 'READY'
    end as validation_status
  from qualifying_batches batch
  join ledger_balances balance
    on balance.item_key = upper(batch.item_code)
   and balance.warehouse_key = upper(batch.warehouse_code)
   and balance.batch_key = upper(batch.batch_number)
  left join public.i_warehouse warehouse
    on warehouse.id = batch.warehouse_id
  where balance.remaining_qty > 0
)
select
  preview.*,
  row_number() over (
    partition by preview.farm_id
    order by preview.warehouse_code, preview.item_code, preview.batch_number
  ) as proposed_gi_line_no,
  sum(preview.remaining_qty) over (
    partition by preview.farm_id
  ) as farm_total_remaining_doc
from preview
order by
  preview.farm_name nulls last,
  preview.farm_id nulls last,
  preview.warehouse_code,
  preview.item_code,
  preview.batch_number;
