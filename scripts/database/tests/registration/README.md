# Registration approval tests

Run from the repository root against a **disposable PostgreSQL database**, using `psql -v ON_ERROR_STOP=1` for each SQL file in order:

1. `scripts/database/tests/registration/fixture.sql`
2. Run `python scripts/database/tests/registration/prepare_fixture.py <temporary-notifications.sql>` and apply that generated file. It extracts the actual shared notification schema/dispatcher, excluding unrelated business module triggers.
3. `app/signup_update/registration_profile.sql`
4. `scripts/database/tests/registration/assertions.sql`

Application checks: `node --test scripts/database/tests/registration/application.test.cjs`.

The fixture mirrors the relevant production `users` column types, including timestamp birthdate. Assertions cover transactional signup, failed signup rollback, admin authorization, failed decision/email queue rollback, empty rejection, ban/unban persistence, decision retries, incomplete-user RLS and pre-request blocking, anonymous business blocking with the existing public password-reset insert preserved, service-only RPC grants, invalid-profile rollback, preserved roles/farms, completion retries, persisted-source notification verification, inactive-rule no-op, unique recipient delivery, email claims/backoff and stale worker leases. Application checks cover no auto-login, migration readiness, server-owned signup metadata, timestamp normalization, profile field allowlisting, email escaping, direct URL/API gates and completion-route access.

These checks do not emulate hosted GoTrue, PostgREST configuration reload, Storage/Realtime transport, or actual SMTP/Graph delivery. Apply the two production SQL files in order before deploying the new app. The signup API deliberately fails before account creation when the migration is absent.

## Deployment requirements

- Configure `NEXT_PUBLIC_SITE_URL` with the public application origin, or use Netlify's `URL`. Activation emails remain retryable when this setting is missing; rejection emails do not require a link.
- Reuse the existing `OUTLOOK_EMAIL`/`OUTLOOK_PASSWORD` or Microsoft Graph transport settings. Account decision correspondence is mandatory and does not use optional admin notification rules or excluded notification recipients.
- `Process due` and `Retry failed emails now` in Notification Setup also process account emails. The activation API schedules processing immediately after persistence; failed sends use backoff. The existing notification-center processing cycle also drains due emails.
- New public signups are initially unassigned; only Super Admins can decide them. Admin-created applicants retain the creator's FMS scope and can be reviewed within existing management boundaries.
- Existing activated accounts retain activation. Missing required information triggers the mandatory page. Existing disabled accounts without a prior registration-completion stamp are not converted to pending applications automatically.
- The migration installs `public.check_registration_access` as the PostgREST pre-request function. It fails if an unrelated role-level hook exists so that it can be composed deliberately. Keep the restrictive registration gate on newly introduced RLS tables used through Storage/Realtime; the pre-request function covers all authenticated Data API queries and RPCs.

## App deployed before the migration

The account-access repository retries its legacy projection only for PostgreSQL error `42703` explicitly identifying the missing `approval_status` column. Existing active accounts then retain their prior access, with profile enforcement deferred until the schema is ready. Inactive/missing accounts remain blocked. New signup still requires the migration readiness RPC; authentication, connectivity, permissions and unrelated schema errors never enable the fallback. Page-level lookup failures return to Login with an error message; API failures remain HTTP 503. This compatibility path does not make the new approval workflow live before SQL deployment.

## Missing registration in User Activation

Supabase Auth inserts the user before updating `raw_app_meta_data` with the admin-supplied registration marker. The registration trigger must handle both INSERT and UPDATE OF raw_app_meta_data. An INSERT-only trigger can leave a banned Auth account without a `public.users` pending row.

After the base registration migration, apply `app/signup_update/repair_registration_auth_metadata.sql`. This installs the corrected, idempotent trigger and readiness check, then recovers only Auth accounts marked `approval_first` that have no public profile. Recovery creates the pending profile and deduplicated signup notification in one transaction. Existing profiles and activation decisions are not changed. Refresh User Activation afterwards; do not re-register the same email.

The assertions reproduce the actual insert-then-update ordering, check subsequent metadata updates do not reban activated users, and run the recovery twice to verify idempotence. These are local database tests; target deployment remains separate.
