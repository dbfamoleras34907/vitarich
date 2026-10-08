# Broiler cycle management

`Saved` remains the Current Cycle created automatically through DOC Placement. Every building, including an excluded building with its own count, references a persisted Cycle Master. A building has at most one active (`Saved`, non-void) flock card. **Open Past Cycle** creates an empty `Past Open` cycle only when the building has no other active card; duplicate historical-month cycles remain blocked.

Cycle Master can manually **Force Close** a Current Cycle or Past Open Cycle even when linked building flock cards remain `Saved` or module transactions are unfinished. The action requires a closing date and 1-1000 character reason, changes the farm cycle status to `Force Closed`, and closes its linked open flock cards so DOC Placement can create the next Current Cycle. Reopening a Force Closed cycle changes it to `Past Open` and reopens only the building cards closed by that Force Close; cards already completed before the action remain closed. Reopening still fails transactionally if a participating building already has another active card. Existing Growing, Harvest & Delivery, and Clean Up validations still apply after reopening.

Force Close and reopen increment the persisted cycle notification revision and enqueue one transactional `CYCLE_MASTER_EDITED` event with `document` routing from `doc_farm_cycles.farm_id`. The event metadata identifies `force_closed` or `reopened`; retries reuse the revision-based dedupe identity. Notification rule activation remains disabled until the SQL is deployed and verified.

Cycle Master management uses `/brd/cycle-master/edit`. The database mutation also checks the authenticated user's active profile and assigned farm; the existing Super Admin permission bypass remains unchanged.

## Deployment order

Apply these files to the same Supabase project used by the application:

1. `app/sql/updated/broiler_cycle_management.sql`
2. `app/sql/updated/open_broiler_past_cycle.sql`
3. `app/brd/fc/new/save_brd_fc_transaction.sql`
4. `app/brd/dr/br_delivery_tables.sql`
5. `app/sql/new/alter_growing_harvest_age.sql`
6. `app/sql/updated/save_br_delivery_transaction.sql`
6. `app/brd/cu/br_cleanup_tables.sql`
7. `app/brd/cu/use_last_mortality_age.sql`
8. `app/brd/cu/allow_harvest_emptied_cleanup.sql`
9. `app/brd/cu/alter_cleanup_quantity_variance.sql`
10. `app/brd/cu/fix_cleanup_consolidated_batch_balance.sql`
11. `app/brd/cu/save_br_cleanup_transaction.sql`
12. `app/brd/cu/reverse_br_cleanup_transaction.sql`

Keep the later Clean Up patches in this order because they extend the trigger functions installed by `br_cleanup_tables.sql`.

Apply `app/sql/new/20261005090927_broiler_cycle_master_ownership.sql` **last**, after the cycle-mask migration. The older Cycle Master files are currently archived under `app/sql/old 9/`; do not reapply them after this correction because they restore the superseded exclusion rule. See [ownership repair](broiler-cycle-master-ownership.md) for the RLK preflight and guarded data repair.

Then apply `app/sql/new/20261008110000_force_close_broiler_cycle.sql` after the centralized notification system and ownership migration.

## Verification

Run `scripts/database/tests/broiler-cycle-management/ownership.sql` in an empty disposable PostgreSQL database. It installs the fixture and prerequisite migrations, then verifies preview/apply repair, repeatability, preserved placement data, excluded counts, master membership, duplicate active-card rejection, cross-farm rejection, close/reopen, failed-action rollback, and owner-only repair privileges. The older `assertions.sql` documents the superseded multiple-open-cycle behavior and must not be used as the acceptance test for this correction.
