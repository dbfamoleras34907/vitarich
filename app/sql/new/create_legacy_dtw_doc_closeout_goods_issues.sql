-- One-time LEGACY / verified-DTW DOC inventory closeout.
--
-- Creates one Posted ordinary Goods Issue per farm. The existing
-- post_goods_issue_inventory_trigger validates on-hand inventory and creates
-- the OUT inventory_postings. This script then adds an audit source tag to
-- those postings.
--
-- SAFETY:
--   1. Run preview_legacy_dtw_doc_goods_issue_inventory.sql first.
--   2. Confirm the configured v_actor is the Super Admin performing the run.
--   3. Execute this whole file once. Any failure rolls back every farm.

begin;

select pg_advisory_xact_lock(
  hashtextextended('LEGACY_DTW_DOC_CLOSEOUT_20261021', 0)
);

create temporary table legacy_dtw_doc_closeout_candidates
on commit drop
as
with dtw_receipt_provenance as (
  select
    imported.entity_id as goods_receipt_id,
    bool_or(job.status = 'Completed') as has_completed_dtw_job,
    string_agg(distinct job.id::text, ', ' order by job.id::text) as dtw_job_ids,
    string_agg(distinct job.file_name, ', ' order by job.file_name) as dtw_source_files,
    string_agg(distinct job.mode, ', ' order by job.mode) as dtw_modes,
    string_agg(distinct job.status, ', ' order by job.status) as dtw_job_statuses,
    string_agg(distinct imported.row_no::text, ', ' order by imported.row_no::text) as dtw_doc_placement_rows
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
    coalesce(dtw.has_completed_dtw_job, false) as has_completed_dtw_job,
    dtw.dtw_job_ids,
    dtw.dtw_source_files,
    dtw.dtw_modes,
    dtw.dtw_job_statuses,
    dtw.dtw_doc_placement_rows,
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
  where is_legacy or has_completed_dtw_job
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
    bool_or(candidate.has_completed_dtw_job) as has_verified_dtw_origin,
    count(distinct candidate.item_id) as item_id_count,
    count(distinct candidate.warehouse_id) as warehouse_id_count,
    count(distinct candidate.alt_uom) as alt_uom_count,
    count(distinct candidate.base_uom) as base_uom_count,
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
      filter (where candidate.dtw_doc_placement_rows is not null) as dtw_doc_placement_rows
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
)
select
  batch.*,
  warehouse.farm_id as warehouse_farm_id,
  balance.remaining_qty,
  case
    when batch.has_verified_dtw_origin and batch.has_legacy_origin then 'VERIFIED DTW + LEGACY'
    when batch.has_verified_dtw_origin then 'VERIFIED DTW'
    else 'LEGACY'
  end as qualifying_source,
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
where balance.remaining_qty > 0;

do $$
declare
  -- Acting Super Admin supplied for this audited one-time run.
  v_actor uuid := 'f21388e8-7692-4e1d-8500-e336c1a7c605';
  -- Confirmed after reviewing the preview query.
  v_confirm boolean := true;
  v_issue_date date := date '2026-10-21';
  v_run_key constant text := 'LEGACY_DTW_DOC_CLOSEOUT_20261021';
  v_year_suffix text := to_char(v_issue_date, 'YY');
  v_sequence bigint;
  v_issue_id bigint;
  v_gi_no text;
  v_header_warehouse_id bigint;
  v_header_warehouse_code text;
  v_header_warehouse_name text;
  v_header_warehouse_count integer;
  v_expected_posting_count integer;
  v_actual_posting_count integer;
  v_expected_qty numeric;
  v_actual_qty numeric;
  v_nonzero_balance_count integer;
  v_farm record;
begin
  if not v_confirm then
    raise exception 'Closeout not confirmed. Review the preview, set v_actor, and change v_confirm to true.';
  end if;

  if v_actor is null then
    raise exception 'v_actor is required and must be an active Super Admin auth.users.id.';
  end if;

  if not exists (select 1 from auth.users actor where actor.id = v_actor) then
    raise exception 'v_actor % does not exist in auth.users.', v_actor;
  end if;

  if not exists (
    select 1
    from public.users actor
    where actor.auth_id = v_actor
      and actor.user_type = 1
      and lower(coalesce(btrim(actor.isactive::text), '1')) in ('1', 'true', 'active')
  ) then
    raise exception 'v_actor % is not an active Super Admin.', v_actor;
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'public.goods_issue'::regclass
      and trigger_row.tgname = 'post_goods_issue_inventory_trigger'
      and trigger_row.tgenabled <> 'D'
  ) then
    raise exception 'The Goods Issue inventory posting trigger is missing or disabled.';
  end if;

  if exists (
    select 1
    from public.goods_issue issue
    where issue.remarks like v_run_key || '%'
  ) then
    raise exception 'Closeout % already has Goods Issue documents. Nothing was inserted.', v_run_key;
  end if;

  if exists (
    select 1
    from legacy_dtw_doc_closeout_candidates candidate
    where candidate.validation_status <> 'READY'
  ) then
    raise exception 'Closeout has blocked rows. Run the preview and correct every validation_status before posting.';
  end if;

  if not exists (select 1 from legacy_dtw_doc_closeout_candidates) then
    raise notice 'No positive LEGACY or verified-DTW DOC inventory remains. Nothing was inserted.';
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('GOODS_ISSUE_NUMBER:GI:' || v_year_suffix, 0)
  );

  select coalesce(max(substring(issue.gi_no from '([0-9]+)$')::bigint), 0)
  into v_sequence
  from public.goods_issue issue
  where issue.gi_no ~ ('^GI-' || v_year_suffix || '-[0-9]+$');

  for v_farm in
    select
      candidate.farm_id,
      min(candidate.farm_code) as farm_code,
      min(candidate.farm_name) as farm_name,
      string_agg(distinct candidate.source_doc_placement_nos, ', ' order by candidate.source_doc_placement_nos) as source_docs
    from legacy_dtw_doc_closeout_candidates candidate
    group by candidate.farm_id
    order by candidate.farm_id
  loop
    v_sequence := v_sequence + 1;
    v_gi_no := format('GI-%s-%s', v_year_suffix, lpad(v_sequence::text, 6, '0'));

    select
      count(distinct candidate.warehouse_id),
      min(candidate.warehouse_id),
      min(candidate.warehouse_code),
      min(candidate.warehouse_name),
      count(*),
      sum(candidate.remaining_qty)
    into
      v_header_warehouse_count,
      v_header_warehouse_id,
      v_header_warehouse_code,
      v_header_warehouse_name,
      v_expected_posting_count,
      v_expected_qty
    from legacy_dtw_doc_closeout_candidates candidate
    where candidate.farm_id = v_farm.farm_id;

    if v_header_warehouse_count <> 1 then
      v_header_warehouse_id := null;
      v_header_warehouse_code := null;
      v_header_warehouse_name := null;
    end if;

    insert into public.goods_issue (
      created_by,
      gi_no,
      issue_date,
      farm_id,
      farm_code,
      farm_name,
      from_warehouse_id,
      from_warehouse_code,
      from_warehouse_name,
      triggered_by,
      status,
      remarks
    ) values (
      v_actor,
      v_gi_no,
      v_issue_date,
      v_farm.farm_id,
      v_farm.farm_code,
      v_farm.farm_name,
      v_header_warehouse_id,
      v_header_warehouse_code,
      v_header_warehouse_name,
      'GI',
      'Draft',
      v_run_key || ' | LEGACY / verified-DTW DOC closeout | Sources: ' || v_farm.source_docs
    )
    returning id into v_issue_id;

    insert into public.goods_issue_items (
      created_by,
      goods_issue_id,
      line_no,
      item_id,
      item_code,
      description,
      batch_rule_id,
      batch_number,
      manufacturing_date,
      expiry_date,
      alt_qty,
      alt_uom,
      base_qty,
      base_uom,
      from_warehouse_id,
      from_warehouse_code,
      from_warehouse_name,
      void
    )
    select
      v_actor,
      v_issue_id,
      row_number() over (
        order by candidate.warehouse_code, candidate.item_code, candidate.batch_number
      )::integer,
      candidate.item_id,
      candidate.item_code,
      candidate.item_description,
      candidate.batch_rule_id,
      candidate.batch_number,
      candidate.manufacturing_date,
      candidate.expiry_date,
      candidate.remaining_qty,
      candidate.alt_uom,
      candidate.remaining_qty,
      candidate.base_uom,
      candidate.warehouse_id,
      candidate.warehouse_code,
      candidate.warehouse_name,
      '1'
    from legacy_dtw_doc_closeout_candidates candidate
    where candidate.farm_id = v_farm.farm_id
    order by candidate.warehouse_code, candidate.item_code, candidate.batch_number;

    update public.goods_issue
    set
      status = 'Posted',
      updated_by = v_actor,
      updated_at = now()
    where id = v_issue_id
      and status = 'Draft';

    if not found then
      raise exception 'Goods Issue % could not be moved from Draft to Posted.', v_gi_no;
    end if;

    update public.inventory_postings posting
    set
      batch_number = coalesce(posting.batch_number, posting.ref),
      ref_type2 = 'LEGACY_DTW_DOC_CLOSEOUT',
      ref2 = v_run_key
    where posting.source_doc_type = 'GOODS_ISSUE'
      and posting.source_docentry = v_issue_id
      and posting.transfer_type = 'OUT';

    get diagnostics v_actual_posting_count = row_count;

    select coalesce(sum(posting.qty), 0)
    into v_actual_qty
    from public.inventory_postings posting
    where posting.source_doc_type = 'GOODS_ISSUE'
      and posting.source_docentry = v_issue_id
      and posting.transfer_type = 'OUT'
      and posting.ref_type2 = 'LEGACY_DTW_DOC_CLOSEOUT'
      and posting.ref2 = v_run_key;

    if v_actual_posting_count <> v_expected_posting_count
      or v_actual_qty is distinct from v_expected_qty then
      raise exception
        'Goods Issue % posting verification failed. Expected % rows / % qty; got % rows / % qty.',
        v_gi_no,
        v_expected_posting_count,
        v_expected_qty,
        v_actual_posting_count,
        v_actual_qty;
    end if;

    select count(*)
    into v_nonzero_balance_count
    from legacy_dtw_doc_closeout_candidates candidate
    where candidate.farm_id = v_farm.farm_id
      and (
        select coalesce(sum(
          case
            when upper(btrim(coalesce(posting.transfer_type, ''))) = 'OUT'
              then -posting.qty
            else posting.qty
          end
        ), 0)
        from public.inventory_postings posting
        where upper(btrim(posting.item_code)) = upper(candidate.item_code)
          and upper(btrim(posting.warehouse_code)) = upper(candidate.warehouse_code)
          and upper(btrim(coalesce(posting.batch_number, posting.ref))) = upper(candidate.batch_number)
      ) <> 0;

    if v_nonzero_balance_count <> 0 then
      raise exception 'Goods Issue % did not close every selected batch to zero inventory.', v_gi_no;
    end if;
  end loop;
end;
$$;

commit;

with line_summary as (
  select
    line.goods_issue_id,
    count(*) as line_count,
    sum(line.base_qty) as issued_qty
  from public.goods_issue_items line
  where line.void = '1'
  group by line.goods_issue_id
),
posting_summary as (
  select
    posting.source_docentry as goods_issue_id,
    count(*) as posting_count,
    sum(posting.qty) as posted_out_qty
  from public.inventory_postings posting
  where posting.source_doc_type = 'GOODS_ISSUE'
    and posting.transfer_type = 'OUT'
    and posting.ref_type2 = 'LEGACY_DTW_DOC_CLOSEOUT'
    and posting.ref2 = 'LEGACY_DTW_DOC_CLOSEOUT_20261021'
  group by posting.source_docentry
)
select
  issue.id,
  issue.gi_no,
  issue.issue_date,
  issue.farm_id,
  issue.farm_code,
  issue.farm_name,
  issue.status,
  line_summary.line_count,
  line_summary.issued_qty,
  posting_summary.posting_count,
  posting_summary.posted_out_qty,
  issue.remarks
from public.goods_issue issue
join line_summary
  on line_summary.goods_issue_id = issue.id
join posting_summary
  on posting_summary.goods_issue_id = issue.id
where issue.remarks like 'LEGACY_DTW_DOC_CLOSEOUT_20261021%'
order by issue.farm_name, issue.farm_id;
