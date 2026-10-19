> **Disposable local test only. Never run these fixture or assertion files in the
> Supabase SQL Editor or against any shared/application database.**

Run only against a fresh disposable PostgreSQL database with `psql -v ON_ERROR_STOP=1`.
The assertions intentionally reference the synthetic farm `10 / FRM000010`, which
is created by `fixture.sql` and is not expected to exist in the application database.

Apply these files in order:

1. `fixture.sql`
2. `app/sql/new/farm_setup_user_assignments.sql`
3. `assertions.sql`

The assertions cover multiple active Admin/User assignments, edit synchronization,
inactive-user rejection, optional clearing, and preservation of unrelated account types.

Deployable application SQL is separate from this test folder. Apply it in this order:

1. `app/sql/new/farm_setup_user_assignments.sql`
2. `app/sql/updated/insert_farm_setup_wizard.sql`
3. `app/sql/updated/update_farm_setup_wizard.sql`
