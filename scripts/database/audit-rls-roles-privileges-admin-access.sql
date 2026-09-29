/*
  RLS policy export for the public schema.

  Read-only. Returns exactly:
    1. RLS title
    2. Affected table
    3. RLS content "code"

  Only policies on public tables with RLS enabled are returned.
*/

SELECT
  p.policyname AS "RLS title",
  format('%I.%I', p.schemaname, p.tablename) AS "affected table",
  format(
    'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;',
    p.policyname,
    p.schemaname,
    p.tablename,
    CASE WHEN p.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
    p.cmd,
    (
      SELECT string_agg(
        CASE
          WHEN lower(role_name) = 'public' THEN 'PUBLIC'
          ELSE format('%I', role_name)
        END,
        ', ' ORDER BY role_name
      )
      FROM unnest(p.roles) AS role_name
    ),
    CASE
      WHEN p.qual IS NOT NULL THEN format(' USING (%s)', p.qual)
      ELSE ''
    END,
    CASE
      WHEN p.with_check IS NOT NULL THEN format(' WITH CHECK (%s)', p.with_check)
      ELSE ''
    END
  ) AS "RLS content code"
FROM pg_catalog.pg_policies AS p
JOIN pg_catalog.pg_class AS c
  ON c.relname = p.tablename
JOIN pg_catalog.pg_namespace AS n
  ON n.oid = c.relnamespace
 AND n.nspname = p.schemaname
WHERE p.schemaname = 'public'
  AND c.relkind IN ('r', 'p')
  AND c.relrowsecurity = true
ORDER BY p.tablename, p.policyname;
