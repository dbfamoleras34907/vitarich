-- Monthly Farm Completion Report
-- Read-only, global-by-permission Hatchery aggregation. This intentionally does
-- not apply users_farms restrictions; the server route enforces report access.

create index if not exists monthly_farm_completion_receiving_farm_date_idx
  on public.recieving (farm_id, doc_date);

create index if not exists monthly_farm_completion_receiving_scope_idx
  on public.recieving ((coalesce(farm_id, delivered_to)), doc_date)
  where btrim(coalesce(void::text, '1')) = '1';

create index if not exists monthly_farm_completion_receiving_items_ref_idx
  on public.recieving_items (docentry, brdr_ref_no);

create index if not exists monthly_farm_completion_classification_ref_idx
  on public.hatch_classification (farm_id, br_no);

create index if not exists monthly_farm_completion_classification_trimmed_ref_idx
  on public.hatch_classification (farm_id, btrim(br_no));

create index if not exists monthly_farm_completion_storage_refs_gin_idx
  on public.egg_storage_mngt using gin ((regexp_split_to_array(btrim(coalesce(classi_ref_no, '')), E'\\s*,\\s*')));

create index if not exists monthly_farm_completion_warming_refs_gin_idx
  on public.egg_pre_warming using gin ((regexp_split_to_array(btrim(coalesce(egg_ref_no, '')), E'\\s*,\\s*')));

create index if not exists monthly_farm_completion_setter_refs_gin_idx
  on public.setter_incubation_process using gin ((regexp_split_to_array(btrim(coalesce(ref_no, '')), E'\\s*,\\s*')));

create index if not exists monthly_farm_completion_transfer_refs_gin_idx
  on public.egg_transfer_process using gin ((regexp_split_to_array(btrim(coalesce(ref_no, '')), E'\\s*,\\s*')));

create index if not exists monthly_farm_completion_hatcher_refs_gin_idx
  on public.egg_hatchery_process using gin ((regexp_split_to_array(btrim(coalesce(egg_ref, '')), E'\\s*,\\s*')));

create index if not exists monthly_farm_completion_pullout_refs_gin_idx
  on public.chick_pullout_process using gin ((regexp_split_to_array(btrim(coalesce(egg_ref_no, '')), E'\\s*,\\s*')));

create index if not exists monthly_farm_completion_grading_refs_gin_idx
  on public.chick_grading_process using gin ((regexp_split_to_array(btrim(coalesce(egg_ref_no, '')), E'\\s*,\\s*')));

create index if not exists monthly_farm_completion_grading_batch_idx
  on public.chick_grading_process (egg_ref_no, batch_code);

create index if not exists monthly_farm_completion_dispatch_item_batch_idx
  on public.dispatch_doc_item (doc_batch_code, dispatch_doc_id);

drop function if exists public.get_monthly_farm_completion_report(text, integer, text, text, text);

create or replace function public.get_monthly_farm_completion_report(
  p_fms_type text,
  p_year integer,
  p_completion_module text default 'doc_dispatch',
  p_completion_rule text default 'any_dispatch',
  p_island text default null,
  p_region text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_today date := timezone('Asia/Manila', now())::date;
  v_result jsonb;
begin
  if p_year < 2000 or p_year > 2100 then
    raise exception 'Choose a valid report year.' using errcode = '22023';
  end if;
  if lower(btrim(coalesce(p_fms_type, ''))) <> 'hatchery' then
    raise exception 'Only Hatchery is available in this report version.' using errcode = '22023';
  end if;
  if p_completion_module not in (
    'receiving', 'egg_classification', 'egg_storage', 'egg_pre_warming', 'egg_setter',
    'egg_transfer', 'egg_hatcher', 'chick_pullout', 'doc_classification', 'doc_dispatch'
  ) then
    raise exception 'Choose a valid Completion Module.' using errcode = '22023';
  end if;
  if p_completion_rule not in ('any_dispatch', 'all_grading_batches') then
    raise exception 'Choose a valid Completion Rule.' using errcode = '22023';
  end if;

  with
  all_farms as materialized (
    select farm.id, farm.code, farm.name,
      coalesce(nullif(btrim(farm.island), ''), 'Island not set') as island,
      coalesce(nullif(btrim(farm.administrative_region), ''), 'Region not set') as region
    from public.farms farm
    where btrim(coalesce(farm.void::text, '0')) = '1'
      and lower(btrim(coalesce(farm.approval_status, ''))) = 'approved'
      and upper(btrim(coalesce(farm.farm_type, ''))) in ('HA', 'HATCHERY')
  ),
  report_farms as materialized (
    select * from all_farms farm
    where (nullif(btrim(p_island), '') is null or farm.island = btrim(p_island))
      and (nullif(btrim(p_region), '') is null or farm.region = btrim(p_region))
  ),
  available_years as materialized (
    select distinct year_value
    from (
      select extract(year from receiving.doc_date)::integer as year_value
      from public.recieving receiving
      join all_farms farm on farm.id = coalesce(receiving.farm_id, receiving.delivered_to)
      where btrim(coalesce(receiving.void::text, '1')) = '1'
        and receiving.doc_date is not null
      union all select p_year
    ) years
    where year_value is not null
  ),
  receiving_scope as materialized (
    select receiving.id, coalesce(receiving.farm_id, receiving.delivered_to)::bigint as farm_id,
      extract(month from receiving.doc_date)::integer as month_no,
      receiving.brdr_ref_no
    from public.recieving receiving
    join report_farms farm on farm.id = coalesce(receiving.farm_id, receiving.delivered_to)
    where btrim(coalesce(receiving.void::text, '1')) = '1'
      and receiving.doc_date >= make_date(p_year, 1, 1)
      and receiving.doc_date < make_date(p_year + 1, 1, 1)
  ),
  receiving_line_references as materialized (
    select distinct receiving.id as receiving_id, btrim(item.brdr_ref_no) as reference
    from receiving_scope receiving
    join public.recieving_items item on item.docentry = receiving.id
    where nullif(btrim(item.brdr_ref_no), '') is not null
  ),
  receiving_references as materialized (
    select receiving_id, reference from receiving_line_references
    union
    select receiving.id, btrim(receiving.brdr_ref_no)
    from receiving_scope receiving
    where nullif(btrim(receiving.brdr_ref_no), '') is not null
      and not exists (select 1 from receiving_line_references line where line.receiving_id = receiving.id)
  ),
  classifications as materialized (
    select distinct reference.receiving_id, classification.classi_ref_no
    from receiving_references reference
    join receiving_scope receiving on receiving.id = reference.receiving_id
    join public.hatch_classification classification
      on btrim(classification.br_no) = reference.reference
     and classification.farm_id = receiving.farm_id
    where coalesce((to_jsonb(classification)->>'is_active')::boolean, true)
  ),
  reached_modules as materialized (
    select receiving.id as receiving_id, 'receiving'::text as module
    from receiving_scope receiving
    where p_completion_module = 'receiving'

    union all
    select distinct classification.receiving_id, 'egg_classification'
    from classifications classification
    where p_completion_module = 'egg_classification'

    union all
    select distinct classification.receiving_id, 'egg_storage'
    from classifications classification
    join public.egg_storage_mngt storage
      on regexp_split_to_array(btrim(coalesce(storage.classi_ref_no, '')), E'\\s*,\\s*') @> array[classification.classi_ref_no::text]
    where p_completion_module = 'egg_storage'
      and btrim(coalesce(to_jsonb(storage)->>'void', '1')) <> '0'

    union all
    select distinct classification.receiving_id, 'egg_pre_warming'
    from classifications classification
    join public.egg_pre_warming warming
      on regexp_split_to_array(btrim(coalesce(warming.egg_ref_no, '')), E'\\s*,\\s*') @> array[classification.classi_ref_no::text]
    where p_completion_module = 'egg_pre_warming'
      and coalesce(warming.is_active, true)

    union all
    select distinct classification.receiving_id, 'egg_setter'
    from classifications classification
    join public.setter_incubation_process setter
      on regexp_split_to_array(btrim(coalesce(setter.ref_no, '')), E'\\s*,\\s*') @> array[classification.classi_ref_no::text]
    where p_completion_module = 'egg_setter'
      and btrim(coalesce(to_jsonb(setter)->>'void', '1')) <> '0'

    union all
    select distinct classification.receiving_id, 'egg_transfer'
    from classifications classification
    join public.egg_transfer_process transfer
      on regexp_split_to_array(btrim(coalesce(transfer.ref_no, '')), E'\\s*,\\s*') @> array[classification.classi_ref_no::text]
    where p_completion_module = 'egg_transfer'
      and btrim(coalesce(to_jsonb(transfer)->>'void', '1')) <> '0'

    union all
    select distinct classification.receiving_id, 'egg_hatcher'
    from classifications classification
    join public.egg_hatchery_process hatcher
      on regexp_split_to_array(btrim(coalesce(hatcher.egg_ref, '')), E'\\s*,\\s*') @> array[classification.classi_ref_no::text]
    where p_completion_module = 'egg_hatcher'
      and btrim(coalesce(to_jsonb(hatcher)->>'void', '1')) <> '0'

    union all
    select distinct classification.receiving_id, 'chick_pullout'
    from classifications classification
    join public.chick_pullout_process pullout
      on regexp_split_to_array(btrim(coalesce(pullout.egg_ref_no, '')), E'\\s*,\\s*') @> array[classification.classi_ref_no::text]
    where p_completion_module = 'chick_pullout'
      and btrim(coalesce(to_jsonb(pullout)->>'void', '1')) <> '0'

    union all
    select distinct classification.receiving_id, 'doc_classification'
    from classifications classification
    join public.chick_grading_process grading
      on regexp_split_to_array(btrim(coalesce(grading.egg_ref_no, '')), E'\\s*,\\s*') @> array[classification.classi_ref_no::text]
    where p_completion_module = 'doc_classification'
      and btrim(coalesce(to_jsonb(grading)->>'void', '1')) <> '0'
  ),
  receiving_grading_batches as materialized (
    select distinct classification.receiving_id, btrim(grading.batch_code) as batch_code
    from classifications classification
    join public.chick_grading_process grading
      on regexp_split_to_array(btrim(coalesce(grading.egg_ref_no, '')), E'\\s*,\\s*') @> array[classification.classi_ref_no::text]
    where p_completion_module = 'doc_dispatch'
      and nullif(btrim(grading.batch_code), '') is not null
      and btrim(coalesce(to_jsonb(grading)->>'void', '1')) <> '0'
  ),
  posted_dispatch_batches as materialized (
    select distinct btrim(item.doc_batch_code) as batch_code
    from public.dispatch_doc_item item
    join public.dispatch_doc dispatch on dispatch.id = item.dispatch_doc_id
    where p_completion_module = 'doc_dispatch'
      and dispatch.status = 'Posted'
      and coalesce(dispatch.is_active, true)
      and nullif(btrim(item.doc_batch_code), '') is not null
  ),
  receiving_completion as materialized (
    select receiving.id, receiving.farm_id, receiving.month_no,
      bool_or(reached.receiving_id is not null) as reached_selected_module,
      count(distinct batch.batch_code) as grading_batch_count,
      count(distinct batch.batch_code) filter (where dispatched.batch_code is not null) as dispatched_batch_count
    from receiving_scope receiving
    left join reached_modules reached
      on reached.receiving_id = receiving.id
     and reached.module = p_completion_module
    left join receiving_grading_batches batch on batch.receiving_id = receiving.id
    left join posted_dispatch_batches dispatched on dispatched.batch_code = batch.batch_code
    group by receiving.id, receiving.farm_id, receiving.month_no
  ),
  month_summary as materialized (
    select completion.farm_id, completion.month_no,
      count(*)::integer as total_count,
      count(*) filter (where case
        when p_completion_module <> 'doc_dispatch' then completion.reached_selected_module
        when p_completion_rule = 'any_dispatch' then completion.dispatched_batch_count > 0
        else completion.grading_batch_count > 0 and completion.dispatched_batch_count = completion.grading_batch_count
      end)::integer as completed_count
    from receiving_completion completion
    group by completion.farm_id, completion.month_no
  ),
  farm_month_values as materialized (
    select farm.id, farm.code, farm.name, farm.island, farm.region, month_series.month_no,
      coalesce(summary.completed_count, 0) as completed_count,
      coalesce(summary.total_count, 0) as total_count,
      make_date(p_year, month_series.month_no, 1) > date_trunc('month', v_today)::date as is_future,
      case
        when make_date(p_year, month_series.month_no, 1) > date_trunc('month', v_today)::date then null
        when coalesce(summary.total_count, 0) = 0 then null
        else round(100.0 * summary.completed_count / summary.total_count)::integer
      end as percentage
    from report_farms farm
    cross join generate_series(1, 12) as month_series(month_no)
    left join month_summary summary
      on summary.farm_id = farm.id
     and summary.month_no = month_series.month_no
  ),
  report_rows as materialized (
    select value.id, value.code, value.name, value.island, value.region,
      jsonb_agg(jsonb_build_object(
        'month', value.month_no,
        'completedCount', value.completed_count,
        'totalCount', value.total_count,
        'percentage', value.percentage,
        'future', value.is_future
      ) order by value.month_no) as months
    from farm_month_values value
    group by value.id, value.code, value.name, value.island, value.region
  )
  select jsonb_build_object(
    'apiVersion', 2,
    'filters', jsonb_build_object(
      'fmsType', 'Hatchery', 'year', p_year, 'completionModule', p_completion_module,
      'completionRule', p_completion_rule,
      'island', nullif(btrim(p_island), ''), 'region', nullif(btrim(p_region), '')
    ),
    'catalog', jsonb_build_object(
      'availableYears', coalesce((select jsonb_agg(year_value order by year_value desc) from available_years), '[]'::jsonb),
      'fmsTypes', jsonb_build_array('Hatchery'),
      'farms', coalesce((select jsonb_agg(jsonb_build_object(
        'id', farm.id, 'code', farm.code, 'name', farm.name, 'island', farm.island, 'region', farm.region
      ) order by farm.island, farm.region, farm.name) from all_farms farm), '[]'::jsonb)
    ),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
      'id', row_data.id, 'code', row_data.code, 'name', row_data.name,
      'island', row_data.island, 'region', row_data.region, 'months', row_data.months
    ) order by row_data.island, row_data.region, row_data.name) from report_rows row_data), '[]'::jsonb),
    'generatedAt', to_char(timezone('Asia/Manila', now()), 'YYYY-MM-DD"T"HH24:MI:SS') || '+08:00'
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_monthly_farm_completion_report(text, integer, text, text, text, text) from public, anon, authenticated;
grant execute on function public.get_monthly_farm_completion_report(text, integer, text, text, text, text) to service_role;

comment on function public.get_monthly_farm_completion_report(text, integer, text, text, text, text) is
  'Global monthly farm completion percentages through a selected Hatchery module for the permission-checked server report.';
