begin;

do $$
declare
  v_function text;
  v_original text;
begin
  select pg_get_functiondef('public.post_br_cleanup_inventory()'::regprocedure)
  into v_function;
  v_original := v_function;

  if position('    ), origin_batches as (' in v_function) > 0 then
    return;
  end if;

  v_function := replace(
    v_function,
    '        card.id as flock_card_id',
    '        card.id as flock_card_id,
        card.building_whse_id,
        card.cycle_no'
  );

  v_function := replace(
    v_function,
    '    ), expected_batches as (
      select distinct origin.item_code, cycle.warehouse_code, origin.batch_no as batch_number
      from selected_cycles cycle
      join public.flock_card_origin origin
        on origin.fc_id = cycle.flock_card_id
       and origin.void = ''1''
    ), on_hand as (',
    '    ), origin_batches as (
      select distinct
        origin.item_code,
        cycle.warehouse_code,
        origin.batch_no as batch_number,
        case
          when cycle.building_whse_id is not null
            and nullif(trim(cycle.cycle_no), '''') is not null
          then format(
            ''DOC:F%s:B%s:%s'',
            new.farm_id,
            cycle.building_whse_id,
            trim(cycle.cycle_no)
          )
          else null
        end as consolidated_batch_number
      from selected_cycles cycle
      join public.flock_card_origin origin
        on origin.fc_id = cycle.flock_card_id
       and origin.void = ''1''
    ), expected_batches as (
      select distinct
        origin.item_code,
        origin.warehouse_code,
        case
          when origin.consolidated_batch_number is not null
            and exists (
              select 1
              from public.inventory_postings consolidated
              where consolidated.source_doc_type = ''DOC_RECEIVING_CONSOLIDATION''
                and consolidated.transfer_type = ''IN''
                and consolidated.item_code = origin.item_code
                and consolidated.warehouse_code = origin.warehouse_code
                and coalesce(consolidated.batch_number, consolidated.ref) = origin.consolidated_batch_number
            )
          then origin.consolidated_batch_number
          else origin.batch_number
        end as batch_number
      from origin_batches origin
    ), on_hand as ('
  );

  if v_function = v_original
    or position('    ), origin_batches as (' in v_function) = 0
    or position('        card.building_whse_id,' in v_function) = 0
  then
    raise exception 'The deployed post_br_cleanup_inventory function does not match the expected pre-fix version. Apply br_cleanup_tables.sql instead.';
  end if;

  execute v_function;
end;
$$;

do $$
declare
  v_function text;
  v_original text;
begin
  select pg_get_functiondef('public.post_br_cleanup_inventory()'::regprocedure)
  into v_function;
  v_original := v_function;

  if position('  ), resolved_lines as (' in v_function) > 0 then
    return;
  end if;

  v_function := replace(
    v_function,
    '    with issue_qty as (
      select
        line.item_code,
        line.from_warehouse_code as warehouse_code,
        line.batch_number,
        sum(line.base_qty) as required_qty
      from public.br_cleanup_lines line
      where line.br_cleanup_id = new.id
        and line.void = ''1''
        and line.item_code is not null
        and line.from_warehouse_code is not null
        and line.base_qty > 0
      group by line.item_code, line.from_warehouse_code, line.batch_number
    ),
    selected_cycles as (',
    '    with selected_cycles as ('
  );

  v_function := replace(
    v_function,
    '      from origin_batches origin
    ), on_hand as (',
    '      from origin_batches origin
    ), issue_qty as (
      select
        line.item_code,
        line.from_warehouse_code as warehouse_code,
        case
          when cycle.building_whse_id is not null
            and nullif(trim(cycle.cycle_no), '''') is not null
            and exists (
              select 1
              from public.inventory_postings consolidated
              where consolidated.source_doc_type = ''DOC_RECEIVING_CONSOLIDATION''
                and consolidated.transfer_type = ''IN''
                and consolidated.item_code = line.item_code
                and consolidated.warehouse_code = line.from_warehouse_code
                and coalesce(consolidated.batch_number, consolidated.ref) = format(
                  ''DOC:F%s:B%s:%s'',
                  new.farm_id,
                  cycle.building_whse_id,
                  trim(cycle.cycle_no)
                )
            )
          then format(
            ''DOC:F%s:B%s:%s'',
            new.farm_id,
            cycle.building_whse_id,
            trim(cycle.cycle_no)
          )
          else line.batch_number
        end as batch_number,
        sum(line.base_qty) as required_qty
      from public.br_cleanup_lines line
      join selected_cycles cycle
        on cycle.warehouse_code = line.from_warehouse_code
      where line.br_cleanup_id = new.id
        and line.void = ''1''
        and line.item_code is not null
        and line.from_warehouse_code is not null
        and line.base_qty > 0
      group by
        line.item_code,
        line.from_warehouse_code,
        line.batch_number,
        cycle.building_whse_id,
        cycle.cycle_no
    ), on_hand as ('
  );

  v_function := replace(
    v_function,
    '  end if;

  insert into public.inventory_postings (',
    '  end if;

  with selected_cycles as (
    select distinct on (line.from_warehouse_code)
      line.from_warehouse_code as warehouse_code,
      card.building_whse_id,
      card.cycle_no
    from public.br_cleanup_lines line
    join public.flock_card card
      on card.farm_id = new.farm_id
     and card.void = ''1''
     and card.status = ''Saved''
     and (
       (line.from_warehouse_id is not null and card.building_whse_id = line.from_warehouse_id)
       or card.building_code = line.from_warehouse_code
     )
    where line.br_cleanup_id = new.id
      and line.void = ''1''
    order by line.from_warehouse_code, card.start_date desc, card.id desc
  ), resolved_lines as (
    select
      line.id,
      format(
        ''DOC:F%s:B%s:%s'',
        new.farm_id,
        cycle.building_whse_id,
        trim(cycle.cycle_no)
      ) as batch_number
    from public.br_cleanup_lines line
    join selected_cycles cycle
      on cycle.warehouse_code = line.from_warehouse_code
    where line.br_cleanup_id = new.id
      and line.void = ''1''
      and cycle.building_whse_id is not null
      and nullif(trim(cycle.cycle_no), '''') is not null
      and exists (
        select 1
        from public.inventory_postings consolidated
        where consolidated.source_doc_type = ''DOC_RECEIVING_CONSOLIDATION''
          and consolidated.transfer_type = ''IN''
          and consolidated.item_code = line.item_code
          and consolidated.warehouse_code = line.from_warehouse_code
          and coalesce(consolidated.batch_number, consolidated.ref) = format(
            ''DOC:F%s:B%s:%s'',
            new.farm_id,
            cycle.building_whse_id,
            trim(cycle.cycle_no)
          )
      )
  )
  update public.br_cleanup_lines line
  set batch_number = resolved.batch_number,
      updated_by = coalesce(new.updated_by, new.created_by),
      updated_at = now()
  from resolved_lines resolved
  where line.id = resolved.id
    and line.batch_number is distinct from resolved.batch_number;

  insert into public.inventory_postings ('
  );

  if v_function = v_original
    or position('    ), issue_qty as (' in v_function) = 0
    or position('  ), resolved_lines as (' in v_function) = 0
  then
    raise exception 'The deployed post_br_cleanup_inventory function does not match the expected consolidated-batch version. Apply br_cleanup_tables.sql instead.';
  end if;

  execute v_function;
end;
$$;

do $$
declare
  v_function text;
  v_original text;
begin
  select pg_get_functiondef('public.post_br_cleanup_variance_inventory()'::regprocedure)
  into v_function;
  v_original := v_function;

  if position('  ), origin_batches as (' in v_function) > 0 then
    return;
  end if;

  v_function := replace(
    v_function,
    '    select distinct card.id as flock_card_id, line.from_warehouse_code as warehouse_code',
    '    select distinct
      card.id as flock_card_id,
      line.from_warehouse_code as warehouse_code,
      card.building_whse_id,
      card.cycle_no'
  );

  v_function := replace(
    v_function,
    '  ), expected_batches as (
    select distinct origin.item_code, cycle.warehouse_code, origin.batch_no as batch_number
    from closed_cycles cycle
    join public.flock_card_origin origin
      on origin.fc_id = cycle.flock_card_id
     and origin.void = ''1''
  ), on_hand as (',
    '  ), origin_batches as (
    select distinct
      origin.item_code,
      cycle.warehouse_code,
      origin.batch_no as batch_number,
      case
        when cycle.building_whse_id is not null
          and nullif(trim(cycle.cycle_no), '''') is not null
        then format(
          ''DOC:F%s:B%s:%s'',
          new.farm_id,
          cycle.building_whse_id,
          trim(cycle.cycle_no)
        )
        else null
      end as consolidated_batch_number
    from closed_cycles cycle
    join public.flock_card_origin origin
      on origin.fc_id = cycle.flock_card_id
     and origin.void = ''1''
  ), expected_batches as (
    select distinct
      origin.item_code,
      origin.warehouse_code,
      case
        when origin.consolidated_batch_number is not null
          and exists (
            select 1
            from public.inventory_postings consolidated
            where consolidated.source_doc_type = ''DOC_RECEIVING_CONSOLIDATION''
              and consolidated.transfer_type = ''IN''
              and consolidated.item_code = origin.item_code
              and consolidated.warehouse_code = origin.warehouse_code
              and coalesce(consolidated.batch_number, consolidated.ref) = origin.consolidated_batch_number
          )
        then origin.consolidated_batch_number
        else origin.batch_number
      end as batch_number
    from origin_batches origin
  ), on_hand as ('
  );

  if v_function = v_original
    or position('  ), origin_batches as (' in v_function) = 0
    or position('      card.building_whse_id,' in v_function) = 0
  then
    raise exception 'The deployed post_br_cleanup_variance_inventory function does not match the expected pre-fix version. Apply br_cleanup_tables.sql instead.';
  end if;

  execute v_function;
end;
$$;

commit;
