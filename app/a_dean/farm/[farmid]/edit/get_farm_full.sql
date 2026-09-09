create or replace function public.get_farm_full(p_farm_id bigint)
returns jsonb
language plpgsql
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'farm', to_jsonb(f),
    'address', jsonb_build_object(
      'address', f.address,
      'province', f.region
    ),
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
            from farm_pens p
            where p.building_id = b.id
          ), '[]'::jsonb)
        )
        order by b.id
      )
      from farm_buildings b
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
      from farm_machines m
      where m.farm_id = f.id
    ), '[]'::jsonb)
  )
  into result
  from farms f
  where f.id = p_farm_id;

  return result;
end;
$$;
