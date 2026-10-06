-- Apply in the target Supabase SQL Editor as the database owner.
-- Existing SELECT/INSERT policies remain in effect; do not bypass RLS.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.doc_cycle_excluded_buildings') IS NULL THEN
    RAISE EXCEPTION 'Cycle exclusion table is missing in this database. No changes applied.'
      USING HINT = 'Confirm the SQL Editor project matches the app Supabase project. Check the existing schema before applying doc_farm_cycles.sql; do not create an empty replacement for existing exclusions.';
  END IF;
END;
$$;

DROP POLICY IF EXISTS doc_cycle_exclusions_delete_empty ON public.doc_cycle_excluded_buildings;
CREATE POLICY doc_cycle_exclusions_delete_empty
ON public.doc_cycle_excluded_buildings FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users app_user
    WHERE app_user.auth_id = auth.uid()
      AND coalesce(btrim(app_user.isactive::text), '0') = '1'
      AND (
        app_user.user_type = 1
        OR (
          EXISTS (
            SELECT 1 FROM public.user_permissions permission
            WHERE permission.user_id = auth.uid()
              AND permission.is_visible
              AND permission.ilink IN (
                '/a_dean/doc-receiving-settings/edit',
                '/a_dean/doc-receiving-settings/insert',
                '/brd/settings/farm-setup/edit',
                '/brd/settings/farm-setup/insert'
              )
          )
          AND EXISTS (
            SELECT 1 FROM public.users_farms assignment
            WHERE assignment.users_id = app_user.id
              AND assignment.farm_id = doc_cycle_excluded_buildings.farm_id
              AND coalesce(btrim(assignment.void::text), '0') = '1'
          )
        )
      )
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.flock_card card
    WHERE card.farm_id = doc_cycle_excluded_buildings.farm_id
      AND card.building_whse_id = doc_cycle_excluded_buildings.building_whse_id
      AND card.void = '1' AND card.status = 'Saved'
  )
);

GRANT DELETE ON public.doc_cycle_excluded_buildings TO authenticated;


create or replace function public.save_doc_cycle_excluded_buildings(
  p_farm_id bigint,
  p_building_whse_ids bigint[]
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_changed_building bigint;
begin
  if p_farm_id is null then
    raise exception 'Please select a farm.';
  end if;

  select coalesce(existing.building_whse_id, requested.building_whse_id) into v_changed_building
  from (
    select building_whse_id from public.doc_cycle_excluded_buildings where farm_id = p_farm_id
  ) existing
  full join (
    select distinct unnest(coalesce(p_building_whse_ids, '{}'::bigint[])) as building_whse_id
  ) requested using (building_whse_id)
  where (existing.building_whse_id is null or requested.building_whse_id is null)
  and exists (
    select 1 from public.flock_card card
    where card.farm_id = p_farm_id
      and card.building_whse_id = coalesce(existing.building_whse_id, requested.building_whse_id)
      and card.void = '1'
      and card.status = 'Saved'
  )
  limit 1;

  if v_changed_building is not null then
    raise exception 'Building % still has an active flock. Complete Clean up before changing its cycle exclusion.', v_changed_building;
  end if;

  delete from public.doc_cycle_excluded_buildings
  where farm_id = p_farm_id
    and not (building_whse_id = any(coalesce(p_building_whse_ids, '{}'::bigint[])));

  if exists (
    select 1 from public.doc_cycle_excluded_buildings
    where farm_id = p_farm_id
      and not (building_whse_id = any(coalesce(p_building_whse_ids, '{}'::bigint[])))
  ) then
    raise exception 'Unable to remove cycle exclusions. Check the DELETE policy for doc_cycle_excluded_buildings.';
  end if;
  insert into public.doc_cycle_excluded_buildings(farm_id, building_whse_id, created_by)
  select p_farm_id, building_id, auth.uid()
  from unnest(coalesce(p_building_whse_ids, '{}'::bigint[])) building_id
  on conflict (farm_id, building_whse_id) do nothing;
end;
$$;

COMMIT;
