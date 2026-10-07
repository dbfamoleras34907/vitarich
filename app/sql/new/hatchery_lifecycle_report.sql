-- Hatchery Lifecycle Report
-- Read-only, farm-scoped report from Hatchery Receiving through Dispatch/Disposal.
-- Deploy after the canonical farm columns from receiving_sources.sql and
-- notification_system.sql are present.

do $$
declare
  required_table text;
begin
  foreach required_table in array array[
    'farms', 'users', 'users_farms', 'user_permissions', 'recieving', 'recieving_items',
    'hatch_classification', 'egg_storage_mngt', 'egg_pre_warming', 'setter_incubation_process',
    'egg_transfer_process', 'egg_hatchery_process', 'chick_pullout_process',
    'chick_grading_process', 'dispatch_doc', 'dispatch_doc_item', 'disposal', 'disposal_item'
  ] loop
    if to_regclass('public.' || required_table) is null then
      raise exception 'Hatchery Lifecycle Report prerequisite table public.% is missing.', required_table;
    end if;
  end loop;
-- 
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'recieving' and column_name = 'farm_id'
  ) then
    raise exception 'Hatchery Lifecycle Report requires public.recieving.farm_id.';
  end if;
end;
$$;

create or replace function public.get_hatchery_lifecycle_report(
  p_farm_ids bigint[] default null,
  p_ta_ids bigint[] default null,
  p_date_from date default null,
  p_date_to date default null,
  p_date_basis text default 'created',
  p_statuses text[] default array['approved']::text[],
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.users%rowtype;
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 25), 1), 100);
  v_date_from date := coalesce(p_date_from, date_trunc('month', timezone('Asia/Manila', now()))::date);
  v_date_to date := coalesce(p_date_to, (date_trunc('month', timezone('Asia/Manila', now())) + interval '1 month - 1 day')::date);
  v_result jsonb;
begin
  if p_date_basis not in ('created', 'receiving') then
    raise exception 'Date basis must be created or receiving.' using errcode = '22023';
  end if;
  if v_date_from > v_date_to then
    raise exception 'Date From cannot be after Date To.' using errcode = '22023';
  end if;

  select * into v_actor
  from public.users
  where auth_id = auth.uid()
    and btrim(coalesce(isactive::text, '0')) = '1';

  if not found then
    raise exception 'An active authenticated user is required.' using errcode = '42501';
  end if;

  if coalesce(v_actor.user_type, 3) <> 1 and not exists (
    select 1
    from public.user_permissions permission
    where permission.user_id = auth.uid()
      and permission.ilink = '/report/hatchery-lifecycle/view'
      and permission.is_visible = true
  ) then
    raise exception 'Hatchery Lifecycle Report permission is required.' using errcode = '42501';
  end if;

  with
  authorized_farms as materialized (
    select distinct farm.id, farm.code, farm.name,
      coalesce(nullif(btrim(farm.island), ''), 'Island not set') as island,
      coalesce(nullif(btrim(farm.administrative_region), ''), 'Region not set') as region
    from public.farms farm
    where btrim(coalesce(farm.void::text, '0')) = '1'
      and lower(btrim(coalesce(farm.approval_status, ''))) = 'approved'
      and upper(btrim(coalesce(farm.farm_type, ''))) in ('HA', 'HATCHERY')
      and (coalesce(cardinality(p_farm_ids), 0) = 0 or farm.id = any(p_farm_ids))
      and (
        coalesce(v_actor.user_type, 3) = 1
        or exists (
          select 1
          from public.users_farms assignment
          where assignment.users_id = v_actor.id
            and btrim(coalesce(assignment.void::text, '0')) = '1'
            and (
              assignment.farm_id = farm.id
              or (assignment.farm_id is null and btrim(coalesce(assignment.farm_code, '')) = farm.code)
            )
        )
      )
  ),
  farm_tas as materialized (
    select distinct farm.id as farm_id, farm.code as farm_code, farm.name as farm_name,
      farm.island, farm.region, ta.id as ta_id, ta.auth_id as ta_auth_id,
      coalesce(nullif(btrim(concat_ws(' ', ta.firstname, ta.middlename, ta.lastname)), ''), ta.email, 'User ' || ta.id::text) as ta_name
    from authorized_farms farm
    join public.users_farms assignment
      on btrim(coalesce(assignment.void::text, '0')) = '1'
     and (assignment.farm_id = farm.id
       or (assignment.farm_id is null and btrim(coalesce(assignment.farm_code, '')) = farm.code))
    join public.users ta on ta.id = assignment.users_id
    where coalesce(ta.user_type, 3) = 3
      and btrim(coalesce(ta.isactive::text, '0')) = '1'
      and (coalesce(cardinality(p_ta_ids), 0) = 0 or ta.id = any(p_ta_ids))
  ),
  filtered_receiving as materialized (
    select receiving.*,
      creator.id as ta_id,
      case when p_date_basis = 'receiving'
        then receiving.doc_date
        else timezone('Asia/Manila', receiving.created_at)::date
      end as report_date,
      case when btrim(coalesce(receiving.void::text, '1')) = '0' then 'voided'
        else lower(btrim(coalesce(receiving.status, 'pending')))
      end as report_status
    from public.recieving receiving
    join authorized_farms farm on farm.id = receiving.farm_id
    left join public.users creator on creator.auth_id = receiving.created_by
    where (case when p_date_basis = 'receiving'
        then receiving.doc_date
        else timezone('Asia/Manila', receiving.created_at)::date
      end) between v_date_from and v_date_to
      and (coalesce(cardinality(p_statuses), 0) = 0 or
        case when btrim(coalesce(receiving.void::text, '1')) = '0' then 'voided'
          else lower(btrim(coalesce(receiving.status, 'pending')))
        end = any(select lower(btrim(value)) from unnest(p_statuses) value))
      and (coalesce(cardinality(p_ta_ids), 0) = 0 or creator.id = any(p_ta_ids))
  ),
  numbered_receiving as materialized (
    select receiving.*,
      count(*) over () as total_count,
      row_number() over (order by receiving.report_date desc, receiving.created_at desc, receiving.id desc) as row_number
    from filtered_receiving receiving
  ),
  paged_receiving as materialized (
    select * from numbered_receiving
    where row_number > (v_page - 1) * v_page_size
      and row_number <= v_page * v_page_size
  ),
  receiving_quantities as materialized (
    select item.docentry as receiving_id,
      coalesce(sum(item.actual_count), 0)::numeric as quantity,
      string_agg(distinct nullif(btrim(item."UoM"), ''), ', ' order by nullif(btrim(item."UoM"), '')) as uom
    from public.recieving_items item
    join filtered_receiving receiving on receiving.id = item.docentry
    group by item.docentry
  ),
  receiving_line_references as materialized (
    select distinct receiving.id as receiving_id, btrim(item.brdr_ref_no) as reference
    from filtered_receiving receiving
    join public.recieving_items item on item.docentry = receiving.id
    where nullif(btrim(item.brdr_ref_no), '') is not null
  ),
  receiving_references as materialized (
    select line.receiving_id, line.reference
    from receiving_line_references line

    union all

    select receiving.id, btrim(receiving.brdr_ref_no)
    from filtered_receiving receiving
    where nullif(btrim(receiving.brdr_ref_no), '') is not null
      and not exists (
        select 1
        from receiving_line_references line
        where line.receiving_id = receiving.id
      )
  ),
  receiving_reference_labels as materialized (
    select reference.receiving_id,
      string_agg(reference.reference, ', ' order by reference.reference) as references
    from receiving_references reference
    group by reference.receiving_id
  ),
  classifications as materialized (
    select distinct on (reference.receiving_id, classification.id)
      reference.receiving_id, classification.*
    from receiving_references reference
    join filtered_receiving receiving on receiving.id = reference.receiving_id
    join public.hatch_classification classification
      on btrim(coalesce(classification.br_no, '')) = reference.reference
     and classification.farm_id = receiving.farm_id
    order by reference.receiving_id, classification.id
  ),
  all_nodes as materialized (
    select receiving.id as receiving_id,
      'RECEIVING:' || receiving.id::text as node_key,
      'Receiving'::text as stage, 0 as stage_order,
      receiving.id as document_id, null::bigint as line_id,
      coalesce(nullif(btrim(receiving.dr_num), ''), 'Receiving ' || receiving.id::text) as document_no,
      coalesce(reference_label.references, receiving.brdr_ref_no) as reference,
      receiving.created_at::timestamptz as occurred_at,
      receiving.report_status as status,
      receiving.report_status = 'voided' as voided,
      quantity.quantity, quantity.uom,
      receiving.farm_id as origin_farm_id, null::bigint as destination_farm_id,
      jsonb_build_object('label', 'Hatchery Receiving', 'receivingDate', receiving.doc_date) as metadata
    from filtered_receiving receiving
    left join receiving_quantities quantity on quantity.receiving_id = receiving.id
    left join receiving_reference_labels reference_label on reference_label.receiving_id = receiving.id

    union all
    select classification.receiving_id,
      'CLASSIFICATION:' || classification.id::text, 'Classification', 1,
      classification.id, null::bigint,
      coalesce(nullif(btrim(classification.classi_ref_no), ''), 'Classification ' || classification.id::text),
      classification.classi_ref_no, classification.created_at::timestamptz,
      case when coalesce((to_jsonb(classification)->>'is_active')::boolean, true) then 'Active' else 'Voided' end,
      not coalesce((to_jsonb(classification)->>'is_active')::boolean, true),
      classification.good_egg::numeric, 'EGG', classification.farm_id, null::bigint,
      jsonb_build_object('label', 'Egg Classification', 'breederReference', classification.br_no)
    from classifications classification

    union all
    select classification.receiving_id,
      'STORAGE:' || storage.id::text, 'Storage', 2, storage.id, null::bigint,
      'Storage ' || storage.id::text, storage.classi_ref_no, storage.created_at::timestamptz,
      case when btrim(coalesce(to_jsonb(storage)->>'void', '1')) = '0' then 'Voided' else 'Active' end,
      btrim(coalesce(to_jsonb(storage)->>'void', '1')) = '0', null::numeric, null::text,
      classification.farm_id, null::bigint, jsonb_build_object('label', 'Egg Storage')
    from classifications classification
    join public.egg_storage_mngt storage
      on classification.classi_ref_no = any(regexp_split_to_array(btrim(coalesce(storage.classi_ref_no, '')), E'\\s*,\\s*'))

    union all
    select classification.receiving_id,
      'PRE_WARMING:' || warming.id::text, 'Pre-Warming', 3, warming.id, null::bigint,
      'Pre-Warming ' || warming.id::text, warming.egg_ref_no, warming.created_at::timestamptz,
      case when coalesce(warming.is_active, true) then 'Active' else 'Voided' end,
      not coalesce(warming.is_active, true), null::numeric, null::text,
      classification.farm_id, null::bigint, jsonb_build_object('label', 'Egg Pre-Warming')
    from classifications classification
    join public.egg_pre_warming warming
      on classification.classi_ref_no = any(regexp_split_to_array(btrim(coalesce(warming.egg_ref_no, '')), E'\\s*,\\s*'))

    union all
    select classification.receiving_id,
      'SETTER:' || setter.id::text, 'Setter', 4, setter.id, null::bigint,
      'Setter ' || setter.id::text, setter.ref_no, setter.created_at::timestamptz,
      case when btrim(coalesce(to_jsonb(setter)->>'void', '1')) = '0' then 'Voided' else 'Active' end,
      btrim(coalesce(to_jsonb(setter)->>'void', '1')) = '0', setter.qty_set_egg::numeric, 'EGG',
      classification.farm_id, null::bigint, jsonb_build_object('label', 'Egg Setter', 'machine', setter.machine_id)
    from classifications classification
    join public.setter_incubation_process setter
      on classification.classi_ref_no = any(regexp_split_to_array(btrim(coalesce(setter.ref_no, '')), E'\\s*,\\s*'))

    union all
    select classification.receiving_id,
      'TRANSFER:' || transfer.id::text, 'Transfer', 5, transfer.id, null::bigint,
      'Transfer ' || transfer.id::text, transfer.ref_no, transfer.created_at::timestamptz,
      case when btrim(coalesce(to_jsonb(transfer)->>'void', '1')) = '0' then 'Voided' else 'Active' end,
      btrim(coalesce(to_jsonb(transfer)->>'void', '1')) = '0', transfer.total_egg_transfer::numeric, 'EGG',
      classification.farm_id, null::bigint, jsonb_build_object('label', 'Egg Transfer')
    from classifications classification
    join public.egg_transfer_process transfer
      on classification.classi_ref_no = any(regexp_split_to_array(btrim(coalesce(transfer.ref_no, '')), E'\\s*,\\s*'))

    union all
    select classification.receiving_id,
      'HATCHER:' || hatcher.id::text, 'Hatcher', 6, hatcher.id, null::bigint,
      'Hatcher ' || hatcher.id::text, hatcher.egg_ref, hatcher.created_at::timestamptz,
      case when btrim(coalesce(to_jsonb(hatcher)->>'void', '1')) = '0' then 'Voided' else 'Active' end,
      btrim(coalesce(to_jsonb(hatcher)->>'void', '1')) = '0', hatcher.total_egg::numeric, 'EGG',
      classification.farm_id, null::bigint, jsonb_build_object('label', 'Egg Hatcher', 'machine', hatcher.machine_no)
    from classifications classification
    join public.egg_hatchery_process hatcher
      on classification.classi_ref_no = any(regexp_split_to_array(btrim(coalesce(hatcher.egg_ref, '')), E'\\s*,\\s*'))

    union all
    select classification.receiving_id,
      'PULLOUT:' || pullout.id::text, 'Pullout', 7, pullout.id, null::bigint,
      coalesce(nullif(btrim(pullout.chick_hatch_ref_no), ''), 'Pullout ' || pullout.id::text),
      pullout.egg_ref_no, pullout.created_at::timestamptz,
      case when btrim(coalesce(to_jsonb(pullout)->>'void', '1')) = '0' then 'Voided' else 'Active' end,
      btrim(coalesce(to_jsonb(pullout)->>'void', '1')) = '0', pullout.chicks_hatched::numeric, 'CHICK',
      classification.farm_id, null::bigint, jsonb_build_object('label', 'Chick Pullout', 'machine', pullout.machine_no)
    from classifications classification
    join public.chick_pullout_process pullout
      on classification.classi_ref_no = any(regexp_split_to_array(btrim(coalesce(pullout.egg_ref_no, '')), E'\\s*,\\s*'))

    union all
    select classification.receiving_id,
      'CHICK_GRADING:' || grading.id::text, 'Chick Grading', 8, grading.id, null::bigint,
      grading.batch_code, grading.egg_ref_no, grading.created_at::timestamptz,
      case when btrim(coalesce(to_jsonb(grading)->>'void', '1')) = '0' then 'Voided' else 'Active' end,
      btrim(coalesce(to_jsonb(grading)->>'void', '1')) = '0',
      (
        coalesce((to_jsonb(grading)->>'class_a')::numeric, 0) +
        coalesce((to_jsonb(grading)->>'class_b')::numeric, 0) +
        coalesce((to_jsonb(grading)->>'class_a_junior')::numeric, 0) +
        coalesce((to_jsonb(grading)->>'class_c')::numeric, 0) +
        coalesce((to_jsonb(grading)->>'cull_chicks')::numeric, 0) +
        coalesce((to_jsonb(grading)->>'dead_chicks')::numeric, 0) +
        coalesce((to_jsonb(grading)->>'infertile')::numeric, 0) +
        coalesce((to_jsonb(grading)->>'dead_germ')::numeric, 0) +
        coalesce((to_jsonb(grading)->>'live_pip')::numeric, 0) +
        coalesce((to_jsonb(grading)->>'dead_pip')::numeric, 0) +
        coalesce((to_jsonb(grading)->>'unhatched')::numeric, 0) +
        coalesce((to_jsonb(grading)->>'rotten')::numeric, 0) +
        coalesce((to_jsonb(grading)->>'exploder')::numeric, 0) +
        coalesce((to_jsonb(grading)->>'unhatched_good')::numeric, 0) +
        coalesce((to_jsonb(grading)->>'unhatched_bad')::numeric, 0) +
        coalesce((to_jsonb(grading)->>'infertile_good')::numeric, 0) +
        coalesce((to_jsonb(grading)->>'infertile_bad')::numeric, 0)
      ), 'CHICK',
      classification.farm_id, null::bigint, jsonb_build_object('label', 'Chick Grading', 'batchCode', grading.batch_code)
    from classifications classification
    join public.chick_grading_process grading
      on classification.classi_ref_no = any(regexp_split_to_array(btrim(coalesce(grading.egg_ref_no, '')), E'\\s*,\\s*'))

    union all
    select classification.receiving_id,
      'DISPATCH:' || dispatch.id::text || ':' || item.id::text, 'Dispatch', 9,
      dispatch.id, item.id, dispatch.dr_no, item.doc_batch_code, dispatch.created_at::timestamptz,
      case when not coalesce(dispatch.is_active, true) then 'Voided' else dispatch.status end,
      not coalesce(dispatch.is_active, true), item.qty::numeric, item.uom::text,
      classification.farm_id, dispatch.destination_farm_id,
      jsonb_build_object('label', 'DOC Dispatch', 'destinationFarmCode', dispatch.destination_farm_code, 'item', item.sku_name)
    from classifications classification
    join public.chick_grading_process grading
      on classification.classi_ref_no = any(regexp_split_to_array(btrim(coalesce(grading.egg_ref_no, '')), E'\\s*,\\s*'))
    join public.dispatch_doc_item item on item.doc_batch_code = grading.batch_code
    join public.dispatch_doc dispatch on dispatch.id = item.dispatch_doc_id

    union all
    select classification.receiving_id,
      'DISPOSAL:' || disposal.id::text || ':' || item.id::text, 'Disposal', 10,
      disposal.id, item.id, 'Disposal ' || disposal.id::text, disposal.batch_code,
      disposal.created_at::timestamptz,
      case when btrim(coalesce(to_jsonb(disposal)->>'void', '1')) = '0' then 'Voided' else 'Active' end,
      btrim(coalesce(to_jsonb(disposal)->>'void', '1')) = '0', item.qty::numeric, item.uom::text,
      classification.farm_id, null::bigint,
      jsonb_build_object('label', 'Disposal', 'item', item.sku)
    from classifications classification
    join public.chick_grading_process grading
      on classification.classi_ref_no = any(regexp_split_to_array(btrim(coalesce(grading.egg_ref_no, '')), E'\\s*,\\s*'))
    join public.disposal disposal on disposal.batch_code = grading.batch_code and disposal.farm_id = classification.farm_id
    join public.disposal_item item on item.disposal_id = disposal.id
  ),
  stage_summary as materialized (
    select receiving.farm_id, receiving.ta_id, node.stage,
      count(distinct node.document_id)::integer as document_count,
      coalesce(sum(node.quantity), 0)::numeric as quantity
    from filtered_receiving receiving
    join all_nodes node on node.receiving_id = receiving.id
    group by receiving.farm_id, receiving.ta_id, node.stage
  ),
  report_rows as materialized (
    select assignment.farm_id, assignment.farm_code, assignment.farm_name,
      assignment.island, assignment.region, assignment.ta_id, assignment.ta_name,
      coalesce(jsonb_object_agg(summary.stage, jsonb_build_object(
        'documentCount', summary.document_count,
        'quantity', summary.quantity
      )) filter (where summary.stage is not null), '{}'::jsonb) as stages
    from farm_tas assignment
    left join stage_summary summary
      on summary.farm_id = assignment.farm_id and summary.ta_id = assignment.ta_id
    group by assignment.farm_id, assignment.farm_code, assignment.farm_name,
      assignment.island, assignment.region, assignment.ta_id, assignment.ta_name
  ),
  review_flags as materialized (
    select receiving.id as receiving_id,
      array_remove(array[
        case when not exists (select 1 from classifications classification where classification.receiving_id = receiving.id)
          then 'No same-farm Classification is linked to this Receiving record.' end,
        case when exists (
          select 1
          from receiving_references reference
          join public.hatch_classification classification
            on btrim(coalesce(classification.br_no, '')) = reference.reference
          where reference.receiving_id = receiving.id
            and classification.farm_id is distinct from receiving.farm_id
        ) then 'A Classification with the same reference belongs to another farm.' end,
        case when receiving.ta_id is null or not exists (
          select 1 from farm_tas assignment
          where assignment.farm_id = receiving.farm_id and assignment.ta_id = receiving.ta_id
        ) then 'The Receiving creator is not a currently assigned active TA for this farm.' end,
        case when exists (
          select 1 from all_nodes node
          where node.receiving_id = receiving.id and node.stage = 'Dispatch' and node.destination_farm_id is null
        ) then 'A Dispatch record is missing its Broiler destination farm.' end
      ], null)::text[] as messages
    from filtered_receiving receiving
  ),
  lifecycle_rows as materialized (
    select receiving.id as receiving_id, receiving.farm_id, receiving.ta_id,
      receiving.report_date, receiving.report_status,
      coalesce(nullif(btrim(receiving.dr_num), ''), 'Receiving ' || receiving.id::text) as document_no,
      coalesce(reference_label.references, receiving.brdr_ref_no) as reference,
      coalesce(to_jsonb(review.messages), '[]'::jsonb) as needs_review,
      coalesce(jsonb_agg(jsonb_build_object(
        'nodeKey', node.node_key,
        'stage', node.stage,
        'stageOrder', node.stage_order,
        'documentId', node.document_id,
        'lineId', node.line_id,
        'documentNo', node.document_no,
        'reference', node.reference,
        'occurredAt', node.occurred_at,
        'status', node.status,
        'voided', node.voided,
        'quantity', node.quantity,
        'uom', node.uom,
        'originFarmId', node.origin_farm_id,
        'destinationFarmId', node.destination_farm_id,
        'destinationFarmName', destination.name,
        'metadata', node.metadata
      ) order by node.stage_order, node.occurred_at, node.document_id, node.line_id) filter (where node.node_key is not null), '[]'::jsonb) as nodes
    from paged_receiving receiving
    left join all_nodes node on node.receiving_id = receiving.id
    left join public.farms destination on destination.id = node.destination_farm_id
    left join review_flags review on review.receiving_id = receiving.id
    left join receiving_reference_labels reference_label on reference_label.receiving_id = receiving.id
    group by receiving.id, receiving.farm_id, receiving.ta_id, receiving.report_date,
      receiving.report_status, receiving.dr_num, receiving.brdr_ref_no, reference_label.references, review.messages
  )
  select jsonb_build_object(
    'apiVersion', 1,
    'filters', jsonb_build_object(
      'dateFrom', v_date_from,
      'dateTo', v_date_to,
      'dateBasis', p_date_basis,
      'farmIds', coalesce(to_jsonb(p_farm_ids), '[]'::jsonb),
      'taIds', coalesce(to_jsonb(p_ta_ids), '[]'::jsonb),
      'statuses', coalesce(to_jsonb(p_statuses), '[]'::jsonb)
    ),
    'catalog', jsonb_build_object(
      'farms', coalesce((select jsonb_agg(jsonb_build_object(
        'id', farm.id, 'code', farm.code, 'name', farm.name,
        'island', farm.island, 'region', farm.region
      ) order by farm.name) from authorized_farms farm), '[]'::jsonb),
      'tas', coalesce((select jsonb_agg(jsonb_build_object(
        'id', assignment.ta_id, 'name', assignment.ta_name, 'farmId', assignment.farm_id
      ) order by assignment.ta_name, assignment.farm_id) from farm_tas assignment), '[]'::jsonb)
    ),
    'rows', coalesce((select jsonb_agg(to_jsonb(row_data) order by row_data.island, row_data.region, row_data.farm_name, row_data.ta_name)
      from report_rows row_data), '[]'::jsonb),
    'lifecycles', coalesce((select jsonb_agg(to_jsonb(lifecycle) order by lifecycle.report_date desc, lifecycle.receiving_id desc)
      from lifecycle_rows lifecycle), '[]'::jsonb),
    'pagination', jsonb_build_object(
      'page', v_page,
      'pageSize', v_page_size,
      'total', coalesce((select max(total_count) from numbered_receiving), 0)
    ),
    'generatedAt', now()
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_hatchery_lifecycle_report(bigint[], bigint[], date, date, text, text[], integer, integer) from public, anon;
grant execute on function public.get_hatchery_lifecycle_report(bigint[], bigint[], date, date, text, text[], integer, integer) to authenticated;

comment on function public.get_hatchery_lifecycle_report(bigint[], bigint[], date, date, text, text[], integer, integer) is
  'Authorized Hatchery Lifecycle Report by origin Hatchery farm and assigned TA, from Receiving through Dispatch and Disposal.';
