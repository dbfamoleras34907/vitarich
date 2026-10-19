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

create index if not exists monthly_farm_completion_active_farm_users_idx
  on public.users_farms (farm_id, users_id)
  where btrim(coalesce(void::text, '0')) = '1';

drop function if exists public.get_monthly_farm_completion_report(text, integer, text, text, text);
drop function if exists public.get_monthly_farm_completion_report(text, integer, text, text, text, text);

create or replace function public.get_monthly_farm_completion_report(
  p_fms_type text,
  p_year integer,
  p_completion_module text default 'doc_dispatch',
  p_completion_rule text default 'any_dispatch',
  p_island text default null,
  p_region text default null,
  p_farm_ids bigint[] default '{}'::bigint[],
  p_user_ids bigint[] default '{}'::bigint[]
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_today date := timezone('Asia/Manila', now())::date;
  v_completion_module_order integer;
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
  if cardinality(coalesce(p_farm_ids, '{}'::bigint[])) > 500
    or exists (select 1 from unnest(coalesce(p_farm_ids, '{}'::bigint[])) value where value <= 0) then
    raise exception 'Choose valid farms.' using errcode = '22023';
  end if;
  if cardinality(coalesce(p_user_ids, '{}'::bigint[])) > 500
    or exists (select 1 from unnest(coalesce(p_user_ids, '{}'::bigint[])) value where value <= 0) then
    raise exception 'Choose valid users.' using errcode = '22023';
  end if;

  v_completion_module_order := case p_completion_module
    when 'receiving' then 0
    when 'egg_classification' then 1
    when 'egg_storage' then 2
    when 'egg_pre_warming' then 3
    when 'egg_setter' then 4
    when 'egg_transfer' then 5
    when 'egg_hatcher' then 6
    when 'chick_pullout' then 7
    when 'doc_classification' then 8
    when 'doc_dispatch' then 9
  end;

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
  farm_users as materialized (
    select distinct farm.id as farm_id, app_user.id as user_id, app_user.auth_id,
      coalesce(
        nullif(btrim(concat_ws(' ', app_user.firstname, app_user.middlename, app_user.lastname)), ''),
        app_user.email,
        'User ' || app_user.id::text
      ) as name,
      coalesce(app_user.user_type, 3)::integer as user_type,
      case coalesce(app_user.user_type, 3)
        when 1 then 'Super Admin'
        when 2 then 'Admin/Supervisor'
        else 'User'
      end as user_type_label
    from all_farms farm
    join public.users_farms assignment
      on assignment.farm_id = farm.id
     and btrim(coalesce(assignment.void::text, '0')) = '1'
    join public.users app_user on app_user.id = assignment.users_id
    where btrim(coalesce(app_user.isactive::text, '0')) = '1'
  ),
  catalog_users as materialized (
    select app_user.user_id as id, app_user.name, app_user.user_type, app_user.user_type_label,
      array_agg(distinct app_user.farm_id order by app_user.farm_id) as farm_ids
    from farm_users app_user
    group by app_user.user_id, app_user.name, app_user.user_type, app_user.user_type_label
  ),
  report_farms as materialized (
    select * from all_farms farm
    where (nullif(btrim(p_island), '') is null or farm.island = btrim(p_island))
      and (nullif(btrim(p_region), '') is null or farm.region = btrim(p_region))
      and (coalesce(cardinality(p_farm_ids), 0) = 0 or farm.id = any(p_farm_ids))
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
      receiving.brdr_ref_no,
      nullif(btrim(to_jsonb(receiving)->>'created_by'), '') as created_by,
      nullif(btrim(to_jsonb(receiving)->>'posted_by'), '') as posted_by
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
    select distinct reference.receiving_id, classification.classi_ref_no,
      nullif(btrim(to_jsonb(classification)->>'created_by'), '') as created_by,
      nullif(btrim(to_jsonb(classification)->>'posted_by'), '') as posted_by
    from receiving_references reference
    join receiving_scope receiving on receiving.id = reference.receiving_id
    join public.hatch_classification classification
      on btrim(classification.br_no) = reference.reference
     and classification.farm_id = receiving.farm_id
    where coalesce((to_jsonb(classification)->>'is_active')::boolean, true)
  ),
  lineage_actor_values as materialized (
    select receiving.id as receiving_id, array[receiving.created_by, receiving.posted_by]::text[] as actor_keys
    from receiving_scope receiving
    where coalesce(cardinality(p_user_ids), 0) > 0

    union all
    select classification.receiving_id, array[classification.created_by, classification.posted_by]::text[]
    from classifications classification
    where coalesce(cardinality(p_user_ids), 0) > 0
      and v_completion_module_order >= 1

    union all
    select classification.receiving_id,
      array[to_jsonb(storage)->>'created_by', to_jsonb(storage)->>'posted_by']::text[]
    from classifications classification
    join public.egg_storage_mngt storage
      on regexp_split_to_array(btrim(coalesce(storage.classi_ref_no, '')), E'\\s*,\\s*') @> array[classification.classi_ref_no::text]
    where coalesce(cardinality(p_user_ids), 0) > 0
      and v_completion_module_order >= 2
      and btrim(coalesce(to_jsonb(storage)->>'void', '1')) <> '0'

    union all
    select classification.receiving_id,
      array[to_jsonb(warming)->>'created_by', to_jsonb(warming)->>'posted_by']::text[]
    from classifications classification
    join public.egg_pre_warming warming
      on regexp_split_to_array(btrim(coalesce(warming.egg_ref_no, '')), E'\\s*,\\s*') @> array[classification.classi_ref_no::text]
    where coalesce(cardinality(p_user_ids), 0) > 0
      and v_completion_module_order >= 3
      and coalesce(warming.is_active, true)

    union all
    select classification.receiving_id,
      array[to_jsonb(setter)->>'created_by', to_jsonb(setter)->>'posted_by']::text[]
    from classifications classification
    join public.setter_incubation_process setter
      on regexp_split_to_array(btrim(coalesce(setter.ref_no, '')), E'\\s*,\\s*') @> array[classification.classi_ref_no::text]
    where coalesce(cardinality(p_user_ids), 0) > 0
      and v_completion_module_order >= 4
      and btrim(coalesce(to_jsonb(setter)->>'void', '1')) <> '0'

    union all
    select classification.receiving_id,
      array[to_jsonb(transfer)->>'created_by', to_jsonb(transfer)->>'posted_by']::text[]
    from classifications classification
    join public.egg_transfer_process transfer
      on regexp_split_to_array(btrim(coalesce(transfer.ref_no, '')), E'\\s*,\\s*') @> array[classification.classi_ref_no::text]
    where coalesce(cardinality(p_user_ids), 0) > 0
      and v_completion_module_order >= 5
      and btrim(coalesce(to_jsonb(transfer)->>'void', '1')) <> '0'

    union all
    select classification.receiving_id,
      array[to_jsonb(hatcher)->>'created_by', to_jsonb(hatcher)->>'posted_by']::text[]
    from classifications classification
    join public.egg_hatchery_process hatcher
      on regexp_split_to_array(btrim(coalesce(hatcher.egg_ref, '')), E'\\s*,\\s*') @> array[classification.classi_ref_no::text]
    where coalesce(cardinality(p_user_ids), 0) > 0
      and v_completion_module_order >= 6
      and btrim(coalesce(to_jsonb(hatcher)->>'void', '1')) <> '0'

    union all
    select classification.receiving_id,
      array[to_jsonb(pullout)->>'created_by', to_jsonb(pullout)->>'posted_by']::text[]
    from classifications classification
    join public.chick_pullout_process pullout
      on regexp_split_to_array(btrim(coalesce(pullout.egg_ref_no, '')), E'\\s*,\\s*') @> array[classification.classi_ref_no::text]
    where coalesce(cardinality(p_user_ids), 0) > 0
      and v_completion_module_order >= 7
      and btrim(coalesce(to_jsonb(pullout)->>'void', '1')) <> '0'

    union all
    select classification.receiving_id,
      array[to_jsonb(grading)->>'created_by', to_jsonb(grading)->>'posted_by']::text[]
    from classifications classification
    join public.chick_grading_process grading
      on regexp_split_to_array(btrim(coalesce(grading.egg_ref_no, '')), E'\\s*,\\s*') @> array[classification.classi_ref_no::text]
    where coalesce(cardinality(p_user_ids), 0) > 0
      and v_completion_module_order >= 8
      and btrim(coalesce(to_jsonb(grading)->>'void', '1')) <> '0'

    union all
    select classification.receiving_id,
      array[to_jsonb(dispatch)->>'created_by', to_jsonb(dispatch)->>'posted_by']::text[]
    from classifications classification
    join public.chick_grading_process grading
      on regexp_split_to_array(btrim(coalesce(grading.egg_ref_no, '')), E'\\s*,\\s*') @> array[classification.classi_ref_no::text]
     and btrim(coalesce(to_jsonb(grading)->>'void', '1')) <> '0'
    join public.dispatch_doc_item item on item.doc_batch_code = grading.batch_code
    join public.dispatch_doc dispatch on dispatch.id = item.dispatch_doc_id
    where coalesce(cardinality(p_user_ids), 0) > 0
      and v_completion_module_order >= 9
      and coalesce(dispatch.is_active, true)
  ),
  lineage_actors as materialized (
    select distinct actor_values.receiving_id, btrim(actor.actor_key) as actor_key
    from lineage_actor_values actor_values
    cross join lateral unnest(actor_values.actor_keys) actor(actor_key)
    where nullif(btrim(actor.actor_key), '') is not null
  ),
  filtered_receiving_scope as materialized (
    select receiving.*
    from receiving_scope receiving
    where coalesce(cardinality(p_user_ids), 0) = 0
      or exists (
        select 1
        from lineage_actors actor
        join farm_users app_user
          on app_user.farm_id = receiving.farm_id
         and app_user.user_id = any(p_user_ids)
         and (actor.actor_key = app_user.auth_id::text or actor.actor_key = app_user.user_id::text)
        where actor.receiving_id = receiving.id
      )
  ),
  filtered_classifications as materialized (
    select classification.*
    from classifications classification
    join filtered_receiving_scope receiving on receiving.id = classification.receiving_id
  ),
  reached_modules as materialized (
    select receiving.id as receiving_id, 'receiving'::text as module
    from filtered_receiving_scope receiving
    where p_completion_module = 'receiving'

    union all
    select distinct classification.receiving_id, 'egg_classification'
    from filtered_classifications classification
    where p_completion_module = 'egg_classification'

    union all
    select distinct classification.receiving_id, 'egg_storage'
    from filtered_classifications classification
    join public.egg_storage_mngt storage
      on regexp_split_to_array(btrim(coalesce(storage.classi_ref_no, '')), E'\\s*,\\s*') @> array[classification.classi_ref_no::text]
    where p_completion_module = 'egg_storage'
      and btrim(coalesce(to_jsonb(storage)->>'void', '1')) <> '0'

    union all
    select distinct classification.receiving_id, 'egg_pre_warming'
    from filtered_classifications classification
    join public.egg_pre_warming warming
      on regexp_split_to_array(btrim(coalesce(warming.egg_ref_no, '')), E'\\s*,\\s*') @> array[classification.classi_ref_no::text]
    where p_completion_module = 'egg_pre_warming'
      and coalesce(warming.is_active, true)

    union all
    select distinct classification.receiving_id, 'egg_setter'
    from filtered_classifications classification
    join public.setter_incubation_process setter
      on regexp_split_to_array(btrim(coalesce(setter.ref_no, '')), E'\\s*,\\s*') @> array[classification.classi_ref_no::text]
    where p_completion_module = 'egg_setter'
      and btrim(coalesce(to_jsonb(setter)->>'void', '1')) <> '0'

    union all
    select distinct classification.receiving_id, 'egg_transfer'
    from filtered_classifications classification
    join public.egg_transfer_process transfer
      on regexp_split_to_array(btrim(coalesce(transfer.ref_no, '')), E'\\s*,\\s*') @> array[classification.classi_ref_no::text]
    where p_completion_module = 'egg_transfer'
      and btrim(coalesce(to_jsonb(transfer)->>'void', '1')) <> '0'

    union all
    select distinct classification.receiving_id, 'egg_hatcher'
    from filtered_classifications classification
    join public.egg_hatchery_process hatcher
      on regexp_split_to_array(btrim(coalesce(hatcher.egg_ref, '')), E'\\s*,\\s*') @> array[classification.classi_ref_no::text]
    where p_completion_module = 'egg_hatcher'
      and btrim(coalesce(to_jsonb(hatcher)->>'void', '1')) <> '0'

    union all
    select distinct classification.receiving_id, 'chick_pullout'
    from filtered_classifications classification
    join public.chick_pullout_process pullout
      on regexp_split_to_array(btrim(coalesce(pullout.egg_ref_no, '')), E'\\s*,\\s*') @> array[classification.classi_ref_no::text]
    where p_completion_module = 'chick_pullout'
      and btrim(coalesce(to_jsonb(pullout)->>'void', '1')) <> '0'

    union all
    select distinct classification.receiving_id, 'doc_classification'
    from filtered_classifications classification
    join public.chick_grading_process grading
      on regexp_split_to_array(btrim(coalesce(grading.egg_ref_no, '')), E'\\s*,\\s*') @> array[classification.classi_ref_no::text]
    where p_completion_module = 'doc_classification'
      and btrim(coalesce(to_jsonb(grading)->>'void', '1')) <> '0'
  ),
  receiving_grading_batches as materialized (
    select distinct classification.receiving_id, btrim(grading.batch_code) as batch_code
    from filtered_classifications classification
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
    from filtered_receiving_scope receiving
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
    'apiVersion', 3,
    'filters', jsonb_build_object(
      'fmsType', 'Hatchery', 'year', p_year, 'completionModule', p_completion_module,
      'completionRule', p_completion_rule,
      'island', nullif(btrim(p_island), ''), 'region', nullif(btrim(p_region), ''),
      'farmIds', to_jsonb(coalesce(p_farm_ids, '{}'::bigint[])),
      'userIds', to_jsonb(coalesce(p_user_ids, '{}'::bigint[]))
    ),
    'catalog', jsonb_build_object(
      'availableYears', coalesce((select jsonb_agg(year_value order by year_value desc) from available_years), '[]'::jsonb),
      'fmsTypes', jsonb_build_array('Hatchery'),
      'farms', coalesce((select jsonb_agg(jsonb_build_object(
        'id', farm.id, 'code', farm.code, 'name', farm.name, 'island', farm.island, 'region', farm.region
      ) order by farm.island, farm.region, farm.name) from all_farms farm), '[]'::jsonb),
      'users', coalesce((select jsonb_agg(jsonb_build_object(
        'id', app_user.id, 'name', app_user.name, 'userType', app_user.user_type,
        'userTypeLabel', app_user.user_type_label, 'farmIds', app_user.farm_ids
      ) order by app_user.name, app_user.id) from catalog_users app_user), '[]'::jsonb)
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

revoke all on function public.get_monthly_farm_completion_report(text, integer, text, text, text, text, bigint[], bigint[]) from public, anon, authenticated;
grant execute on function public.get_monthly_farm_completion_report(text, integer, text, text, text, text, bigint[], bigint[]) to service_role;

comment on function public.get_monthly_farm_completion_report(text, integer, text, text, text, text, bigint[], bigint[]) is
  'Global monthly farm completion percentages through a selected Hatchery module with farm and inherited creator/poster filters.';
