# Harvest weight

Harvest rows now show Harvest Quantity, Net Live Weight, and calculated ALW in that order. ALW is Net Live Weight / Harvest Quantity, independently of the existing flock-card ALW g. Missing weight or zero quantity displays blank. Zero weight is permitted; negative/nonfinite values are rejected. Existing documents remain blank until a weight is entered.

`br_delivery_lines.net_live_weight` stores the visible allocation-group total on each batch allocation. Read one value per allocation group; do not sum this column across batch lines. ALW is derived using the entire group's harvest quantity. Paste/export and batch allocation preserve this contract.

## Deployment

Apply these files in order before releasing the UI:

1. `app/admin/notifications/notification_system.sql` (updated centralized source verifier).
2. `app/brd/dr/alter_br_delivery_lines_add_net_live_weight.sql`.
3. `app/brd/dr/save_br_delivery_transaction.sql`.

Target database deployment has not been performed. The notification catalog intentionally keeps `BR_DELIVERY.ruleActivationReady` false until target farm constraints, authenticated saves, and dispatcher behavior are verified. The new non-null farm check is NOT VALID for historical rows, but enforces new inserts and updates; the existing farm foreign key remains authoritative.

## Notification readiness

- Module: `BR_DELIVERY`; supported events: `BR_DELIVERY_POSTED` and `BR_DELIVERY_EDITED`. No document Void operation is exposed by the current Harvest UI/API; voiding replaced batch lines during a save is not a document Void.
- `save_br_delivery_transaction` updates a persisted business-content fingerprint only after all lines and the optional inventory post succeed. It increments `notification_revision` for a changed existing draft or a successful post. Initial draft creation does not emit an event.
- The revision update invokes `enqueue_br_delivery_event`, a narrowly scoped SECURITY DEFINER trigger that writes the centralized outbox in the same transaction. The business RPC remains SECURITY INVOKER and retains RLS. The outbox is not writable by ordinary callers in the local fixture.
- Deduplication: event key + document ID + persisted revision. Identical draft retries do not increment revision; returning to a previous value is a new edit. Posted retries are rejected by the existing status check. The central outbox and event/recipient unique constraints prevent duplicate events and deliveries.
- Any failure rolls back the business transaction and its event. The dispatcher alone matches active rules and recipients; source inspection confirms no matching rule creates no deliveries and does not alter the business outcome.
- Routing mode is `document`: the trigger reads `br_delivery.farm_id` for both farm and recipient farm. The RPC resolves code/name from `public.farms`, and the dispatcher joins the persisted header to `public.farms(id)`, checks matching event farm IDs and Broiler type, and marks mismatches/missing IDs invalid before recipient matching. Missing farm cannot become global delivery.

## Verification

Passed: focused ESLint, full TypeScript, delivery helper tests (calculation, missing/zero quantity, grouped paste, rejection, clearing), and isolated PostgreSQL tests for insert/reload, canonical farm, authenticated RPC writing through the protected outbox trigger, repeated draft saves, A-to-B-to-A edits, negative-weight rollback, invalid farm, and duplicate post rejection.

The disposable SQL fixture does not model actual inventory posting triggers, production business RLS, or dispatcher recipient tables. Dispatcher no-rule and farm rejection behavior were inspected in source, not exercised against the target database. Actual deployed inventory failures, recipient routing/deduplication, and target RLS remain deployment verification requirements.

To reproduce locally in an empty disposable PostgreSQL database, apply `scripts/database/tests/harvest-weight/fixture.sql`, then the weight migration, then the save RPC, then `scripts/database/tests/harvest-weight/assertions.sql`, all with `ON_ERROR_STOP=1`. Do not apply the test fixture to an application database.
