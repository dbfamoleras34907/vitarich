# Broiler cycle management

`Saved` remains the Current Cycle created automatically through DOC Placement. **Open Past Cycle** creates a new empty `Past Open` cycle for one historical month. A building may have multiple open cycles, while duplicate cycles for the same building and historical month remain blocked.

A Current Cycle cannot be closed while any linked building flock card is still `Saved`; Cycle Master shows a disabled Close button until every participating building is no longer current. A Past Open Cycle may still be closed directly. A Closed Cycle may be reopened even when one of its buildings has another open cycle. Existing Growing, Harvest & Delivery, and Clean Up validations still apply after reopening.

Cycle Master management uses `/brd/cycle-master/edit`. The database mutation also checks the authenticated user's active profile and assigned farm; the existing Super Admin permission bypass remains unchanged.

## Deployment order

Apply these files to the same Supabase project used by the application:

1. `app/sql/updated/broiler_cycle_management.sql`
2. `app/sql/updated/open_broiler_past_cycle.sql`
3. `app/brd/fc/new/save_brd_fc_transaction.sql`
4. `app/brd/dr/br_delivery_tables.sql`
5. `app/brd/dr/save_br_delivery_transaction.sql`
6. `app/brd/cu/br_cleanup_tables.sql`
7. `app/brd/cu/use_last_mortality_age.sql`
8. `app/brd/cu/allow_harvest_emptied_cleanup.sql`
9. `app/brd/cu/alter_cleanup_quantity_variance.sql`
10. `app/brd/cu/fix_cleanup_consolidated_batch_balance.sql`
11. `app/brd/cu/save_br_cleanup_transaction.sql`
12. `app/brd/cu/reverse_br_cleanup_transaction.sql`

Keep the later Clean Up patches in this order because they extend the trigger functions installed by `br_cleanup_tables.sql`.

## Verification

Run `scripts/database/tests/broiler-cycle-management/fixture.sql`, both Cycle Master migration files, then `scripts/database/tests/broiler-cycle-management/assertions.sql` in a disposable PostgreSQL database. The assertions cover multiple open cycles for one building, historical-month guards, linked flock-card state changes, Current Cycle close protection, and Cycle Master edit permission enforcement.
