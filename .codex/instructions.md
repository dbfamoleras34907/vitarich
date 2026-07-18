# Data Access Rule

Before creating any Supabase query, SQL statement, API request, fetch call, axios call, server action data loader, or React data-loading hook:

1. Search the codebase for an existing implementation.
2. Reuse the existing repository/data-access function if it already fits.
3. Extend the existing function with typed parameters when the difference is minor.
4. Create a new query only when the operation has materially different:
   - authorization rules
   - selected fields
   - joins
   - filters
   - business behavior
   - return type
5. New reusable queries must live in the shared data-access layer, preferably:
   - `lib/data/repositories`
   - `lib/data/queries`
   - `lib/data/mutations`
   - `lib/data/query-keys`
6. Route-local `api.ts`, components, hooks, and pages should call shared functions instead of recreating queries.
7. Do not create generic arbitrary table/query executors.
8. Preserve Supabase RLS, auth behavior, client/server boundaries, and TypeScript types.
9. Avoid `jmb` and `_baja` unless explicitly asked.