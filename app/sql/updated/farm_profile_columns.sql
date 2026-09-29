-- Apply before the Farm Setup RPCs and farm_void_rls.sql.
-- Existing farms remain unset; farms.region retains its legacy province data.
alter table public.farms
  add column if not exists production_model text null,
  add column if not exists island text null,
  add column if not exists administrative_region text null;

alter table public.farms
  drop constraint if exists farms_production_model_check,
  drop constraint if exists farms_island_check,
  drop constraint if exists farms_administrative_region_check;

alter table public.farms
  add constraint farms_production_model_check
    check (production_model in ('Internal', 'Contract Grower')),
  add constraint farms_island_check
    check (island in ('Luzon', 'Visayas', 'Mindanao')),
  add constraint farms_administrative_region_check check (administrative_region in (
    'National Capital Region (NCR)',
    'Cordillera Administrative Region (CAR)',
    'Region I (Ilocos Region)',
    'Region II (Cagayan Valley)',
    'Region III (Central Luzon)',
    'Region IV-A (CALABARZON)',
    'MIMAROPA Region',
    'Region V (Bicol Region)',
    'Region VI (Western Visayas)',
    'Negros Island Region (NIR)',
    'Region VII (Central Visayas)',
    'Region VIII (Eastern Visayas)',
    'Region IX (Zamboanga Peninsula)',
    'Region X (Northern Mindanao)',
    'Region XI (Davao Region)',
    'Region XII (SOCCSKSARGEN)',
    'Region XIII (Caraga)',
    'Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)'
  ));

comment on column public.farms.administrative_region is
  'Philippine administrative region; separate from legacy region (province).';

create or replace function public.validate_farm_profile_payload(p_farm jsonb)
returns void
language plpgsql
immutable
set search_path = public
as $$
declare
  v_production_model text := nullif(btrim(p_farm->>'production_model'), '');
  v_island text := nullif(btrim(p_farm->>'island'), '');
  v_administrative_region text := nullif(btrim(p_farm->>'administrative_region'), '');
begin
  if v_production_model is null then
    raise exception 'Production Model is required.';
  end if;
  if v_island is null then
    raise exception 'Island Group is required.';
  end if;
  if v_administrative_region is null then
    raise exception 'Region is required.';
  end if;

  if v_production_model not in ('Internal', 'Contract Grower') then
    raise exception 'Production Model is invalid.';
  end if;
  if v_island not in ('Luzon', 'Visayas', 'Mindanao') then
    raise exception 'Island Group is invalid.';
  end if;
  if v_administrative_region not in (
    'National Capital Region (NCR)',
    'Cordillera Administrative Region (CAR)',
    'Region I (Ilocos Region)',
    'Region II (Cagayan Valley)',
    'Region III (Central Luzon)',
    'Region IV-A (CALABARZON)',
    'MIMAROPA Region',
    'Region V (Bicol Region)',
    'Region VI (Western Visayas)',
    'Negros Island Region (NIR)',
    'Region VII (Central Visayas)',
    'Region VIII (Eastern Visayas)',
    'Region IX (Zamboanga Peninsula)',
    'Region X (Northern Mindanao)',
    'Region XI (Davao Region)',
    'Region XII (SOCCSKSARGEN)',
    'Region XIII (Caraga)',
    'Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)'
  ) then
    raise exception 'Region is invalid.';
  end if;
end;
$$;

revoke all on function public.validate_farm_profile_payload(jsonb) from public;
