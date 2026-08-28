begin;
-- 
-- Definitive BR-CU deployment: replaces the complete mortality-age,
-- normalized balance-validation, cleanup posting, and variance posting functions.
create or replace function public.get_brd_fc_last_mortality_age(p_flock_card_id bigint)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select max(line.age)::integer
  from public.flock_card card
  join public.brd_fc growing
    on growing.card_no = card.card_no
   and growing.farm_id = card.farm_id
   and growing.void = '1'
  join public.brd_fc_line line
    on line.fc_id = growing.id
   and line.void = '1'
  where card.id = p_flock_card_id
    and card.void = '1'
    and coalesce(line.mort_am, 0) + coalesce(line.mort_pm, 0) > 0;
$$;

create or replace function public.post_br_cleanup_inventory()
returns trigger
language plpgsql
as $$
declare
  v_target_age integer := 0;
  v_invalid_building text;
  v_shortage_item text;
  v_shortage_warehouse text;
  v_shortage_batch text;
  v_required_qty numeric;
  v_available_qty numeric;
begin
  if new.status <> 'Posted' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'Posted' then
    return new;
  end if;

  if not exists (
    select 1
    from public.br_cleanup_lines line
    where line.br_cleanup_id = new.id
      and line.void = '1'
      and line.base_qty > 0
  ) then
    raise exception 'Clean up requires at least one positive quantity line.';
  end if;

  if exists (
    select 1
    from public.br_cleanup_lines line
    where line.br_cleanup_id = new.id
      and line.void = '1'
      and (line.alt_qty < 1 or line.base_qty <= 0)
  ) then
    raise exception 'Clean up quantity must be at least 1.';
  end if;

  select coalesce(settings.target_cleanup_age, 0)
  into v_target_age
  from public.brd_cu_settings settings
  where settings.farm_id = new.farm_id
    and settings.void = '1'
  order by settings.created_at desc
  limit 1;

  v_target_age := coalesce(v_target_age, 0);

  perform pg_advisory_xact_lock(hashtext('BR-CU:' || coalesce(new.farm_id::text, '') || ':' || building.warehouse_code))
  from (
    select distinct line.from_warehouse_code as warehouse_code
    from public.br_cleanup_lines line
    where line.br_cleanup_id = new.id
      and line.void = '1'
      and nullif(line.from_warehouse_code, '') is not null
  ) building;

  with selected_buildings as (
    select distinct line.from_warehouse_id, line.from_warehouse_code
    from public.br_cleanup_lines line
    where line.br_cleanup_id = new.id
      and line.void = '1'
  ), active_cycles as (
    select selected.from_warehouse_code, cycle.id, cycle.building_name, cycle.actual_age
    from selected_buildings selected
    left join lateral (
      select
        card.id,
        card.building_name,
        public.get_brd_fc_last_mortality_age(card.id) as actual_age
      from public.flock_card card
      where card.farm_id = new.farm_id
        and card.void = '1'
        and card.status = 'Saved'
        and (
          (selected.from_warehouse_id is not null and card.building_whse_id = selected.from_warehouse_id)
          or card.building_code = selected.from_warehouse_code
        )
      order by card.start_date desc, card.id desc
      limit 1
    ) cycle on true
  )
  select coalesce(active.building_name, active.from_warehouse_code)
  into v_invalid_building
  from active_cycles active
  where active.id is null
     or active.actual_age is null
     or active.actual_age < v_target_age
  limit 1;

  if v_invalid_building is not null then
    raise exception '% has no eligible active Flock Card cycle or mortality age for Clean up.', v_invalid_building;
  end if;

  with selected_cycles as (
      select distinct on (line.from_warehouse_code)
        line.from_warehouse_code as warehouse_code,
        card.id as flock_card_id,
        card.building_whse_id,
        card.cycle_no
      from public.br_cleanup_lines line
      join public.flock_card card
        on card.farm_id = new.farm_id
       and card.void = '1'
       and card.status = 'Saved'
       and (
         (line.from_warehouse_id is not null and card.building_whse_id = line.from_warehouse_id)
         or card.building_code = line.from_warehouse_code
       )
      where line.br_cleanup_id = new.id
        and line.void = '1'
      order by line.from_warehouse_code, card.start_date desc, card.id desc
    ), origin_batches as (
      select distinct
        btrim(origin.item_code) as item_code,
        btrim(cycle.warehouse_code) as warehouse_code,
        btrim(origin.batch_no) as batch_number,
        case
          when cycle.building_whse_id is not null
            and nullif(trim(cycle.cycle_no), '') is not null
          then format(
            'DOC:F%s:B%s:%s',
            new.farm_id,
            cycle.building_whse_id,
            trim(cycle.cycle_no)
          )
          else null
        end as consolidated_batch_number
      from selected_cycles cycle
      join public.flock_card_origin origin
        on origin.fc_id = cycle.flock_card_id
       and origin.void = '1'
    ), expected_batches as (
      select distinct
        origin.item_code,
        origin.warehouse_code,
        case
          when origin.consolidated_batch_number is not null
            and exists (
              select 1
              from public.inventory_postings consolidated
              where consolidated.source_doc_type = 'DOC_RECEIVING_CONSOLIDATION'
                and consolidated.transfer_type = 'IN'
                and upper(btrim(consolidated.item_code)) = upper(origin.item_code)
                and upper(btrim(consolidated.warehouse_code)) = upper(origin.warehouse_code)
                and upper(btrim(coalesce(consolidated.batch_number, consolidated.ref))) = upper(origin.consolidated_batch_number)
            )
          then origin.consolidated_batch_number
          else origin.batch_number
        end as batch_number
      from origin_batches origin
    ), issue_qty as (
      select
        btrim(line.item_code) as item_code,
        btrim(line.from_warehouse_code) as warehouse_code,
        case
          when cycle.building_whse_id is not null
            and nullif(trim(cycle.cycle_no), '') is not null
            and exists (
              select 1
              from public.inventory_postings consolidated
              where consolidated.source_doc_type = 'DOC_RECEIVING_CONSOLIDATION'
                and consolidated.transfer_type = 'IN'
                and upper(btrim(consolidated.item_code)) = upper(btrim(line.item_code))
                and upper(btrim(consolidated.warehouse_code)) = upper(btrim(line.from_warehouse_code))
                and upper(btrim(coalesce(consolidated.batch_number, consolidated.ref))) = upper(format(
                  'DOC:F%s:B%s:%s',
                  new.farm_id,
                  cycle.building_whse_id,
                  trim(cycle.cycle_no)
                ))
            )
          then format(
            'DOC:F%s:B%s:%s',
            new.farm_id,
            cycle.building_whse_id,
            trim(cycle.cycle_no)
          )
          else btrim(line.batch_number)
        end as batch_number,
        sum(line.base_qty) as required_qty
      from public.br_cleanup_lines line
      join selected_cycles cycle
        on cycle.warehouse_code = line.from_warehouse_code
      where line.br_cleanup_id = new.id
        and line.void = '1'
        and line.item_code is not null
        and line.from_warehouse_code is not null
        and line.base_qty > 0
      group by
        line.item_code,
        line.from_warehouse_code,
        line.batch_number,
        cycle.building_whse_id,
        cycle.cycle_no
    ), allowed_batches as (
      select expected.item_code, expected.warehouse_code, expected.batch_number
      from expected_batches expected

      union

      select issued.item_code, issued.warehouse_code, issued.batch_number
      from issue_qty issued
      where exists (
        select 1
        from public.inventory_postings consolidated
        where consolidated.source_doc_type = 'DOC_RECEIVING_CONSOLIDATION'
          and consolidated.transfer_type = 'IN'
          and upper(btrim(consolidated.item_code)) = upper(issued.item_code)
          and upper(btrim(consolidated.warehouse_code)) = upper(issued.warehouse_code)
          and upper(btrim(coalesce(consolidated.batch_number, consolidated.ref))) = upper(issued.batch_number)
      )
    ), on_hand as (
      select
        btrim(posting.item_code) as item_code,
        btrim(posting.warehouse_code) as warehouse_code,
        btrim(coalesce(posting.batch_number, posting.ref)) as batch_number,
        sum(case when posting.transfer_type = 'OUT' then -posting.qty else posting.qty end) as qty
      from public.inventory_postings posting
      group by
        btrim(posting.item_code),
        btrim(posting.warehouse_code),
        btrim(coalesce(posting.batch_number, posting.ref))
    ), expected_qty as (
      select expected.item_code, expected.warehouse_code, expected.batch_number, coalesce(stock.qty, 0) as qty
      from allowed_batches expected
      left join on_hand stock
        on upper(stock.item_code) = upper(expected.item_code)
       and upper(stock.warehouse_code) = upper(expected.warehouse_code)
       and upper(stock.batch_number) is not distinct from upper(expected.batch_number)
    )
    select
      coalesce(issued.item_code, expected.item_code),
      coalesce(issued.warehouse_code, expected.warehouse_code),
      coalesce(issued.batch_number, expected.batch_number),
      coalesce(issued.required_qty, 0),
      coalesce(expected.qty, 0)
    into
      v_shortage_item,
      v_shortage_warehouse,
      v_shortage_batch,
      v_required_qty,
      v_available_qty
    from expected_qty expected
    full join issue_qty issued
      on upper(issued.item_code) = upper(expected.item_code)
     and upper(issued.warehouse_code) = upper(expected.warehouse_code)
     and upper(issued.batch_number) is not distinct from upper(expected.batch_number)
    where coalesce(issued.required_qty, 0) > coalesce(expected.qty, 0) + 0.000001
    limit 1;

  if v_shortage_item is not null then
    raise exception 'Clean up balance mismatch for item %, warehouse %, batch %: saved base quantity % exceeds live balance % (document %).',
      v_shortage_item,
      v_shortage_warehouse,
      coalesce(v_shortage_batch, '<none>'),
      v_required_qty,
      v_available_qty,
      new.gi_no;
  end if;

  with selected_cycles as (
    select distinct on (line.from_warehouse_code)
      line.from_warehouse_code as warehouse_code,
      card.building_whse_id,
      card.cycle_no
    from public.br_cleanup_lines line
    join public.flock_card card
      on card.farm_id = new.farm_id
     and card.void = '1'
     and card.status = 'Saved'
     and (
       (line.from_warehouse_id is not null and card.building_whse_id = line.from_warehouse_id)
       or card.building_code = line.from_warehouse_code
     )
    where line.br_cleanup_id = new.id
      and line.void = '1'
    order by line.from_warehouse_code, card.start_date desc, card.id desc
  ), resolved_lines as (
    select
      line.id,
      format(
        'DOC:F%s:B%s:%s',
        new.farm_id,
        cycle.building_whse_id,
        trim(cycle.cycle_no)
      ) as batch_number
    from public.br_cleanup_lines line
    join selected_cycles cycle
      on cycle.warehouse_code = line.from_warehouse_code
    where line.br_cleanup_id = new.id
      and line.void = '1'
      and cycle.building_whse_id is not null
      and nullif(trim(cycle.cycle_no), '') is not null
      and exists (
        select 1
        from public.inventory_postings consolidated
        where consolidated.source_doc_type = 'DOC_RECEIVING_CONSOLIDATION'
          and consolidated.transfer_type = 'IN'
          and upper(btrim(consolidated.item_code)) = upper(btrim(line.item_code))
          and upper(btrim(consolidated.warehouse_code)) = upper(btrim(line.from_warehouse_code))
          and upper(btrim(coalesce(consolidated.batch_number, consolidated.ref))) = upper(format(
            'DOC:F%s:B%s:%s',
            new.farm_id,
            cycle.building_whse_id,
            trim(cycle.cycle_no)
          ))
      )
  )
  update public.br_cleanup_lines line
  set batch_number = resolved.batch_number,
      updated_by = coalesce(new.updated_by, new.created_by),
      updated_at = now()
  from resolved_lines resolved
  where line.id = resolved.id
    and line.batch_number is distinct from resolved.batch_number;

  insert into public.inventory_postings (
    source_doc_type, source_docentry, item_code, warehouse_code, bin_code,
    qty, created_by, ref_type, ref, batch_number, transfer_type, ref_type2, ref2
  )
  select
    'BR_CLEANUP',
    new.id,
    line.item_code,
    line.from_warehouse_code,
    'MAIN SUB BIN',
    sum(line.base_qty),
    coalesce(new.updated_by, new.created_by),
    'batch_code',
    line.batch_number,
    line.batch_number,
    'OUT',
    null,
    null
  from public.br_cleanup_lines line
  where line.br_cleanup_id = new.id
    and line.void = '1'
    and line.item_code is not null
    and line.from_warehouse_code is not null
    and line.base_qty > 0
  group by line.item_code, line.from_warehouse_code, line.batch_number;

  with selected_buildings as (
    select distinct line.from_warehouse_id, line.from_warehouse_code
    from public.br_cleanup_lines line
    where line.br_cleanup_id = new.id
      and line.void = '1'
  ), cycles_to_close as (
    select distinct on (selected.from_warehouse_code) card.id
    from selected_buildings selected
    join public.flock_card card
      on card.farm_id = new.farm_id
     and card.void = '1'
     and card.status = 'Saved'
     and (
       (selected.from_warehouse_id is not null and card.building_whse_id = selected.from_warehouse_id)
       or card.building_code = selected.from_warehouse_code
     )
    order by selected.from_warehouse_code, card.start_date desc, card.id desc
  )
  update public.flock_card card
  set status = 'Closed',
      updated_by = coalesce(new.updated_by, new.created_by),
      updated_at = now(),
      extra = coalesce(card.extra, '{}'::jsonb) || jsonb_build_object(
        'closed_by_doc_type', 'BR_CLEANUP',
        'closed_by_docentry', new.id,
        'closed_by_doc_no', new.gi_no,
        'closed_at', now()
      )
  where card.id in (select id from cycles_to_close);

  return new;
end;
$$;

drop trigger if exists post_br_cleanup_inventory_trigger on public.br_cleanup;
create trigger post_br_cleanup_inventory_trigger
after update of status on public.br_cleanup
for each row
when (new.status = 'Posted' and old.status is distinct from 'Posted')
execute function public.post_br_cleanup_inventory();

create or replace function public.post_br_cleanup_variance_inventory()
returns trigger
language plpgsql
as $$
begin
  if new.status <> 'Posted' then
    return new;
  end if;

  if exists (
    select 1
    from public.inventory_postings posting
    where posting.source_doc_type = 'BR_CLEANUP_VARIANCE'
      and posting.source_docentry = new.id
  ) then
    return new;
  end if;

  insert into public.inventory_postings (
    source_doc_type, source_docentry, item_code, warehouse_code, bin_code,
    qty, created_by, ref_type, ref, batch_number, transfer_type, ref_type2, ref2
  )
  with closed_cycles as (
    select distinct
      card.id as flock_card_id,
      line.from_warehouse_code as warehouse_code,
      card.building_whse_id,
      card.cycle_no
    from public.br_cleanup_lines line
    join public.flock_card card
      on card.farm_id = new.farm_id
      and card.void = '1'
      and card.status = 'Closed'
      and card.extra->>'closed_by_doc_type' = 'BR_CLEANUP'
      and nullif(card.extra->>'closed_by_docentry', '')::bigint = new.id
      and (
        (line.from_warehouse_id is not null and card.building_whse_id = line.from_warehouse_id)
        or card.building_code = line.from_warehouse_code
      )
    where line.br_cleanup_id = new.id
      and line.void = '1'
  ), origin_batches as (
    select distinct
      btrim(origin.item_code) as item_code,
      btrim(cycle.warehouse_code) as warehouse_code,
      btrim(origin.batch_no) as batch_number,
      case
        when cycle.building_whse_id is not null
          and nullif(trim(cycle.cycle_no), '') is not null
        then format(
          'DOC:F%s:B%s:%s',
          new.farm_id,
          cycle.building_whse_id,
          trim(cycle.cycle_no)
        )
        else null
      end as consolidated_batch_number
    from closed_cycles cycle
    join public.flock_card_origin origin
      on origin.fc_id = cycle.flock_card_id
     and origin.void = '1'
  ), expected_batches as (
    select distinct
      origin.item_code,
      origin.warehouse_code,
      case
        when origin.consolidated_batch_number is not null
          and exists (
            select 1
            from public.inventory_postings consolidated
            where consolidated.source_doc_type = 'DOC_RECEIVING_CONSOLIDATION'
              and consolidated.transfer_type = 'IN'
              and upper(btrim(consolidated.item_code)) = upper(origin.item_code)
              and upper(btrim(consolidated.warehouse_code)) = upper(origin.warehouse_code)
              and upper(btrim(coalesce(consolidated.batch_number, consolidated.ref))) = upper(origin.consolidated_batch_number)
          )
        then origin.consolidated_batch_number
        else origin.batch_number
      end as batch_number
    from origin_batches origin
  ), on_hand as (
    select
      btrim(posting.item_code) as item_code,
      btrim(posting.warehouse_code) as warehouse_code,
      btrim(coalesce(posting.batch_number, posting.ref)) as batch_number,
      sum(case when posting.transfer_type = 'OUT' then -posting.qty else posting.qty end) as qty
    from public.inventory_postings posting
    group by
      btrim(posting.item_code),
      btrim(posting.warehouse_code),
      btrim(coalesce(posting.batch_number, posting.ref))
  )
  select
    'BR_CLEANUP_VARIANCE',
    new.id,
    expected.item_code,
    expected.warehouse_code,
    'MAIN SUB BIN',
    stock.qty,
    coalesce(new.updated_by, new.created_by),
    'batch_code',
    expected.batch_number,
    expected.batch_number,
    'OUT',
    'BR_CLEANUP',
    new.gi_no
  from expected_batches expected
  join on_hand stock
    on upper(stock.item_code) = upper(expected.item_code)
   and upper(stock.warehouse_code) = upper(expected.warehouse_code)
   and upper(stock.batch_number) is not distinct from upper(expected.batch_number)
  where stock.qty > 0.000001;

  return new;
end;
$$;

drop trigger if exists zz_post_br_cleanup_variance_inventory_trigger on public.br_cleanup;
create trigger zz_post_br_cleanup_variance_inventory_trigger
after update of status on public.br_cleanup
for each row
when (new.status = 'Posted' and old.status is distinct from 'Posted')
execute function public.post_br_cleanup_variance_inventory();
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.post_br_cleanup_inventory()'::regprocedure)
  into v_definition;

  if position('Clean up balance mismatch for item' in v_definition) = 0
    or position('allowed_batches as' in v_definition) = 0
    or position('upper(btrim(consolidated.item_code))' in v_definition) = 0
    or position('Clean up quantity exceeds the live placement-batch balance.' in v_definition) > 0
  then
    raise exception 'BR-CU posting function verification failed.';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
