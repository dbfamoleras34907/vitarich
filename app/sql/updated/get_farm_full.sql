create or replace function public.get_farm_full(p_farm_id bigint)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'farm', to_jsonb(f),
    'address', coalesce((
      select jsonb_build_object(
        'address', a.address,
        'barangay', a.barangay,
        'city', a.city,
        'province', a.province
      )
      from public.farm_addresses a
      where a.farm_id = f.id
      limit 1
    ), jsonb_build_object(
      'address', f.address,
      'barangay', null,
      'city', null,
      'province', f.region
    )),
    'associated_warehouses', coalesce(to_jsonb(f.associated_warehouses), '[]'::jsonb),
    'buildings', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', b.id,
          'data', jsonb_build_object(
            'code', b.code,
            'name', b.name,
            'status', b.status,
            'remarks', b.remarks
          ),
          'pens', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', p.id,
                'data', jsonb_build_object(
                  'code', p.code,
                  'name', p.name,
                  'status', p.status
                )
              )
              order by p.id
            )
            from public.farm_pens p
            where p.building_id = b.id
          ), '[]'::jsonb)
        )
        order by b.id
      )
      from public.farm_buildings b
      where b.farm_id = f.id
    ), '[]'::jsonb),
    'machines', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'data', jsonb_build_object(
            'code', m.code,
            'name', m.name,
            'type', m.type,
            'capacity', m.capacity,
            'remarks', m.remarks
          )
        )
        order by m.id
      )
      from public.farm_machines m
      where m.farm_id = f.id
    ), '[]'::jsonb)
  )
  into result
  from public.farms f
  where f.id = p_farm_id;

  return result;
end;
$$;

revoke all on function public.get_farm_full(bigint) from public;
grant execute on function public.get_farm_full(bigint) to authenticated;
