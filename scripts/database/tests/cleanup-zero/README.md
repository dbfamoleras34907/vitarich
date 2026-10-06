Run only against a fresh disposable PostgreSQL database with `psql -v ON_ERROR_STOP=1`.

1. Apply `fixture.sql`.
2. Run `python scripts/database/tests/cleanup-zero/prepare_fixture.py <temporary-output.sql>` and apply its output. This extracts the actual centralized notification tables and dispatcher from the repository.
3. Apply `app/brd/cu/br_cleanup_tables.sql`.
4. Apply `app/brd/cu/allow_harvest_emptied_cleanup.sql`.
5. Apply `app/brd/cu/save_br_cleanup_transaction.sql`.
6. Apply `assertions.sql` (its scenarios roll back).

To verify the SQL Editor deployment bundle, replace steps 4 and 5 with `app/brd/cu/deploy_harvest_emptied_cleanup.sql`, apply that file a second time to check migration reapplication, then run step 6. This checks the exact file used for deployment, including zero-quantity inventory posting and retry deduplication.

The fixture simplifies authentication and business tables; it does not reproduce production RLS. See `docs/broiler-cleanup-zero.md` for behavior, coverage and deployment order.

For reversal, apply `reversal-fixture.sql` after the base setup, then `app/brd/cu/reverse_br_cleanup_transaction.sql` twice (to check reapplication), then `reversal-assertions.sql`. This suite rolls back its scenarios and also exercises the RPC as the `authenticated` database role. The fixture's `auth.uid()` is fixed; production JWT and RLS are not emulated.

Run `node scripts/database/tests/cleanup-zero/selection.test.cjs` for the application eligibility regression: harvested zero stock without mortality age must appear in Clean Up, while Harvest retains its positive-stock and age filters.

Run `node scripts/database/tests/cleanup-zero/allocation.test.cjs` for the form's actual batch-selection handler: selecting a harvest-emptied batch resets the default requested quantity of 1 to 0, while partial positive allocations and rejection of unqualified empty batches stay intact.
