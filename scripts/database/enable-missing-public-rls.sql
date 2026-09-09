-- Install using the Supabase SQL Editor as postgres (or a table-owning admin).
-- Then run separately:
-- SELECT * FROM public.enable_missing_public_rls();
--
-- Only public tables whose RLS is disabled are changed. Existing policies
-- remain intact. Authenticated users receive unrestricted row policies for
-- SELECT, INSERT, and UPDATE; existing restrictive policies still apply.
-- This does not grant table/sequence privileges or create a DELETE policy.
-- Tables containing jmb or _baja in their names are excluded.
-- Any error rolls back the entire function call, including RLS changes.

BEGIN;

CREATE OR REPLACE FUNCTION public.enable_missing_public_rls()
RETURNS TABLE (schema_name text, table_name text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT c.oid, n.nspname, c.relname
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND NOT c.relrowsecurity
      AND strpos(lower(c.relname), 'jmb') = 0
      AND strpos(lower(c.relname), '_baja') = 0
    ORDER BY c.oid
  LOOP
    -- Serialize concurrent calls and recheck after acquiring the lock.
    EXECUTE format('LOCK TABLE ONLY %I.%I IN ACCESS EXCLUSIVE MODE',
      target.nspname, target.relname);

    IF (SELECT c.relrowsecurity FROM pg_catalog.pg_class AS c
        WHERE c.oid = target.oid) THEN
      CONTINUE;
    END IF;

    -- Do not silently replace an existing policy with a different definition.
    IF EXISTS (
      SELECT 1 FROM pg_catalog.pg_policy AS p
      WHERE p.polrelid = target.oid
        AND p.polname IN (
          'migration_authenticated_select',
          'migration_authenticated_insert',
          'migration_authenticated_update'
        )
    ) THEN
      RAISE EXCEPTION 'Policy name collision on %.%; no changes committed',
        target.nspname, target.relname;
    END IF;

    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      target.nspname, target.relname);
    EXECUTE format(
      'CREATE POLICY migration_authenticated_select ON %I.%I FOR SELECT TO authenticated USING (true)',
      target.nspname, target.relname);
    EXECUTE format(
      'CREATE POLICY migration_authenticated_insert ON %I.%I FOR INSERT TO authenticated WITH CHECK (true)',
      target.nspname, target.relname);
    EXECUTE format(
      'CREATE POLICY migration_authenticated_update ON %I.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)',
      target.nspname, target.relname);

    schema_name := target.nspname;
    table_name := target.relname;
    RETURN NEXT;
  END LOOP;
END;
$function$;

-- Administrative maintenance only; never expose this function to app users.
REVOKE ALL ON FUNCTION public.enable_missing_public_rls() FROM PUBLIC, anon, authenticated;

COMMIT;
