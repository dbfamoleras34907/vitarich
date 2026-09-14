Run only against a fresh disposable PostgreSQL database using `psql -v ON_ERROR_STOP=1`.

1. Run `python scripts/database/tests/harvest-reversal/prepare_fixture.py <temporary-directory>`; apply its `fixture.sql`.
2. Run `python scripts/database/tests/cleanup-zero/prepare_fixture.py <temporary-directory>/notifications.sql`; apply the result.
3. Apply `app/brd/cu/br_cleanup_tables.sql`, `app/brd/cu/deploy_harvest_emptied_cleanup.sql`, and `app/brd/cu/reverse_br_cleanup_transaction.sql`.
4. Apply `app/brd/dr/settings/brd_dr_settings.sql`, generated `harvest-posting.sql`, `app/brd/dr/alter_br_delivery_lines_add_net_live_weight.sql`, and `app/brd/dr/save_br_delivery_transaction.sql`.
5. Apply `app/brd/dr/reverse_br_delivery_transaction.sql` twice to verify reapplication.
6. Apply `assertions.sql` (test scenarios roll back).

The fixture uses actual Harvest DDL and posting functions but omits the historical Goods Issue data import. Authentication is fixed by the disposable fixture; production JWT and RLS are not emulated. See `docs/broiler-harvest-reversal.md` for the business and notification contracts.
