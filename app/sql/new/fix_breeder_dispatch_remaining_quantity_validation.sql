-- Deploy this migration to replace the stale breeder-dispatch RPC that rejects
-- valid Egg Laying inventory. Drafts never reserve quantity; only Posted lines
-- are included in the remaining-balance calculation.
begin;

create or replace function public.save_breeder_dispatch_transaction(
  p_id bigint,
  p_payload jsonb,
  p_post boolean default false
)
returns bigint
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id bigint := p_id;
  v_farm public.farms%rowtype;
  v_destination public.farms%rowtype;
  v_input_line jsonb;
  v_line record;
  v_source_quantity numeric;
  v_posted_quantity numeric;
  v_category_label text;
  v_line_no integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_farm
  from public.farms
  where id = (p_payload ->> 'farm_id')::bigint
    and upper(farm_type) = 'BE';
  if not found then
    raise exception 'Canonical breeder farm is required';
  end if;

  if nullif(p_payload ->> 'farm_destination_id', '') is not null then
    select * into v_destination
    from public.farms
    where id = (p_payload ->> 'farm_destination_id')::bigint
      and upper(farm_type) = 'HA'
      and void::text = '1'
      and approval_status = 'approved';
    if not found then
      raise exception 'Active hatchery destination is required';
    end if;
  elsif p_payload ->> 'destination' not like 'Walk-in Customer - %' then
    raise exception 'Hatchery destination is required';
  end if;

  if jsonb_typeof(p_payload -> 'lines') is distinct from 'array'
    or jsonb_array_length(p_payload -> 'lines') = 0 then
    raise exception 'Dispatch lines are required';
  end if;

  -- Validate each source/category against the database, not the client-supplied
  -- Available value. Only Posted documents consume a dispatch source.
  for v_line in
    select
      value ->> 'source_type' as source_type,
      (value ->> 'source_record_id')::bigint as source_record_id,
      value ->> 'category' as category,
      sum((value ->> 'dispatch_qty')::numeric) as requested_quantity
    from jsonb_array_elements(p_payload -> 'lines')
    group by value ->> 'source_type', (value ->> 'source_record_id')::bigint, value ->> 'category'
  loop
    if v_line.requested_quantity <= 0 or trunc(v_line.requested_quantity) <> v_line.requested_quantity then
      raise exception 'Dispatch quantities must be positive whole numbers';
    end if;

    select coalesce(sum(line.dispatch_qty), 0) into v_posted_quantity
    from public.tbl_brd_dispatch_line line
    join public.tbl_brd_dispatch header on header.id = line.dispatch_id
    where header.status = 'Posted'
      and line.source_type = v_line.source_type
      and line.source_record_id = v_line.source_record_id
      and line.category = v_line.category;

    if v_line.source_type = 'Egg Laying' then
      select case v_line.category
        when 'hatching_egg' then laying.hatching_egg
        when 'classb' then laying.classb
        when 'junior' then laying.junior
        when 'table_egg' then coalesce(laying.table_egg_dirty, 0)
          + coalesce(laying.table_egg_misshapen, 0)
          + coalesce(laying.table_egg_off_size, 0)
          + coalesce(laying.table_egg_thin_shell, 0)
        when 'jumbo' then laying.jumbo
        when 'crack' then laying.crack
        when 'condemn' then laying.condemn
      end into v_source_quantity
      from public.tbl_egglaying laying
      join public.tbl_placement placement on placement.id = laying.placement_id
      where laying.id = v_line.source_record_id
        and laying.is_active = true
        and laying.date_laying <= (p_payload ->> 'dispatch_date')::date
        and placement.farm_id = v_farm.id;

      v_category_label := case v_line.category
        when 'hatching_egg' then 'Hatching Egg (<54g)'
        when 'classb' then 'Class B (<52g - 53g)'
        when 'junior' then 'Junior (<49g - 51g)'
        when 'table_egg' then 'Table Egg'
        when 'jumbo' then 'Jumbo'
        when 'crack' then 'Crack'
        when 'condemn' then 'Condemn'
      end;
    elsif v_line.source_type = 'Population Record' then
      select case v_line.category
        when 'mc' then coalesce(performance.mc_male, 0) + coalesce(performance.mc_female, 0)
        when 'culls' then coalesce(performance.cull_male, 0) + coalesce(performance.cull_female, 0)
        when 'kitchen' then coalesce(performance.kitchen_male, 0) + coalesce(performance.kitchen_female, 0)
        when 'condemn' then coalesce(performance.condem_male, 0) + coalesce(performance.condem_female, 0)
      end into v_source_quantity
      from public.tbl_breeder_daily_performance performance
      join public.tbl_placement placement on placement.id = performance.placement_id
      where performance.id = v_line.source_record_id
        and performance.isactive = true
        and performance.daterec <= (p_payload ->> 'dispatch_date')::date
        and placement.farm_id = v_farm.id;

      v_category_label := case v_line.category
        when 'mc' then 'Mortality'
        when 'culls' then 'Culls'
        when 'kitchen' then 'Kitchen'
        when 'condemn' then 'Condemn'
      end;
    else
      raise exception 'Unsupported dispatch source type: %', v_line.source_type;
    end if;

    if v_source_quantity is null or v_category_label is null then
      raise exception 'The selected % source is no longer available.', coalesce(v_line.category, 'dispatch');
    end if;
    if v_line.requested_quantity > v_source_quantity - v_posted_quantity then
      raise exception 'Dispatch quantity exceeds the remaining % quantity.', v_category_label;
    end if;
  end loop;

  if v_id is null then
    insert into public.tbl_brd_dispatch (
      document_no, dispatch_date, farm_id, farm_code, farm_name, destination,
      farm_destination_id, hauler_name, plate_number, truck_seal, remarks,
      status, created_by
    ) values (
      p_payload ->> 'document_no', (p_payload ->> 'dispatch_date')::date,
      v_farm.id, v_farm.code, v_farm.name,
      coalesce(v_destination.name, p_payload ->> 'destination'), v_destination.id,
      p_payload ->> 'hauler_name', p_payload ->> 'plate_number',
      p_payload ->> 'truck_seal', p_payload ->> 'remarks', 'Draft', auth.uid()
    ) returning id into v_id;
  else
    update public.tbl_brd_dispatch
    set dispatch_date = (p_payload ->> 'dispatch_date')::date,
      farm_id = v_farm.id,
      farm_code = v_farm.code,
      farm_name = v_farm.name,
      destination = coalesce(v_destination.name, p_payload ->> 'destination'),
      farm_destination_id = v_destination.id,
      hauler_name = p_payload ->> 'hauler_name',
      plate_number = p_payload ->> 'plate_number',
      truck_seal = p_payload ->> 'truck_seal',
      remarks = p_payload ->> 'remarks',
      updated_by = auth.uid()
    where id = v_id and status = 'Draft';
    if not found then
      raise exception 'Only an accessible draft dispatch can be edited';
    end if;
  end if;

  delete from public.tbl_brd_dispatch_line where dispatch_id = v_id;
  for v_input_line in select value from jsonb_array_elements(p_payload -> 'lines') loop
    v_line_no := v_line_no + 1;
    insert into public.tbl_brd_dispatch_line (
      dispatch_id, line_no, source_type, source_record_id, source_date,
      category, category_label, placement_id, placement_date, building_id,
      building_name, pen_id, pen_name, dr_no, source_available, dispatch_qty,
      remarks, created_by
    ) values (
      v_id, v_line_no, v_input_line ->> 'source_type',
      (v_input_line ->> 'source_record_id')::bigint,
      (v_input_line ->> 'source_date')::date, v_input_line ->> 'category',
      v_input_line ->> 'category_label', (v_input_line ->> 'placement_id')::bigint,
      (v_input_line ->> 'placement_date')::date,
      (v_input_line ->> 'building_id')::bigint, v_input_line ->> 'building_name',
      (v_input_line ->> 'pen_id')::bigint, v_input_line ->> 'pen_name',
      v_input_line ->> 'dr_no', (v_input_line ->> 'source_available')::bigint,
      (v_input_line ->> 'dispatch_qty')::bigint, v_input_line ->> 'remarks', auth.uid()
    );
  end loop;

  if p_post then
    update public.tbl_brd_dispatch
    set status = 'Posted', updated_by = auth.uid()
    where id = v_id;
  end if;
  return v_id;
end;
$$;

revoke all on function public.save_breeder_dispatch_transaction(bigint, jsonb, boolean) from public, anon;
grant execute on function public.save_breeder_dispatch_transaction(bigint, jsonb, boolean) to authenticated;
notify pgrst, 'reload schema';

commit;
