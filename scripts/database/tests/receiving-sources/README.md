# Disposable receiving source tests

Run only in an empty disposable local PostgreSQL database. `fixture.sql` creates a reduced application schema and synthetic records. It must never run against Supabase or an application database. Hosted RLS/session behavior is not reproduced in full.

Generate the centralized notification fixture using:

```powershell
python scripts/database/tests/cleanup-zero/prepare_fixture.py tmp/receiving-notifications-fixture.sql
```

Apply each file with `psql -X -v ON_ERROR_STOP=1` in this order:

1. `scripts/database/tests/receiving-sources/fixture.sql`
2. `tmp/receiving-notifications-fixture.sql`
3. `app/inv/doc-receiving/receiving_sources.sql`
4. `app/inv/gr/gr_inventory_postings.sql`
5. `app/inv/doc-receiving/receiving_source_notifications.sql`
6. `app/inv/doc-receiving/receiving_dispatch_transactions.sql`
7. `scripts/database/tests/receiving-sources/assertions.sql`
8. `scripts/database/tests/receiving-sources/broiler.sql`
9. `scripts/database/tests/receiving-sources/access-notifications.sql`

With `psql` on PATH and that disposable server on `127.0.0.1:55438`, run `python scripts/database/tests/receiving-sources/concurrency.py receiving_sources_test<N>` against the same database, then apply `dispatch-transactions.sql`. The concurrency test only accepts database names beginning `receiving_sources_test`. One concurrent receiver succeeds and the other is rejected without exceeding the source quantity.

The tests use synthetic authorization claims and service roles, inspect ledger quantities and lineage, and exercise the actual checked-in posting and dispatcher functions. Assertions fail with SQL exceptions.
