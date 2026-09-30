# Growing and Harvest age behavior

Deploy `app/sql/new/alter_growing_harvest_age.sql`, then
`app/sql/updated/save_br_delivery_transaction.sql`, before releasing the screen
change. Both scripts are safe to reapply.

A Posted Harvest & Delivery no longer locks Growing. Growing rows, feed allocations,
mortality entries, and Save remain available after Harvest is posted. Full Growing
reversal keeps its separate downstream-document safety check.

Harvest Age is initialized from the linked Growing actual age, remains editable on
Draft Harvest documents, and is persisted on each allocation group. Posting checks
the saved Harvest age against Target Delivery Age; later Growing edits do not change
the historical age saved on an existing Harvest document.

## Notification readiness audit

Existing catalog module `BRD_FC` declares `BRD_FC_POSTED`, `BRD_FC_EDITED` and
`BRD_FC_VOIDED`, all with `document` farm routing. The guard adds no new events.

- Post/Edit: `save_brd_fc_transaction` writes `brd_fc_save_requests` after all
  changes succeed. Its `enqueue_brd_fc_save_event` trigger writes the transactional
  outbox with `<eventKey>:<request_id>` deduplication. Committed request retries
  return the stored result before performing new writes.
- Row reversal: `enqueue_brd_fc_reversal_event` emits one Edit for the persisted
  reversal using `BRD_FC_EDITED:REVERSAL:<line_id>:<transaction_id>`. The underlying
  reversal handles already-reversed quantities without a new transition.
- Full Void: `reverse_brd_fc_transaction` writes the outbox only after the full
  reversal succeeds, with `BRD_FC_VOIDED:<growing_id>` and conflict suppression.
- Each path reads `brd_fc.farm_id` joined to `public.farms(id)`; this is also the
  recipient farm. The centralized dispatcher validates the persisted source farm,
  marks mismatches/missing identities invalid, and never widens them to global
  delivery. Active matching rules and recipient permissions remain centralized;
  no matching active rule produces no recipient delivery. Delivery conflict
  suppression prevents duplicate recipients on dispatcher retries.

The local transaction/guard assertions verify failed operations roll back all
writes and emit nothing, and successful save retries do not duplicate events.
The remaining notification statements above are source inspection of the existing
hooks/catalog/dispatcher, not new target deployment or recipient-delivery tests.
Notification activation readiness remains unchanged pending target verification.

Validation completed locally: transaction and guard SQL assertions, a two-session
check showing Growing waits for an in-flight Harvest post and rejects the edit
after it commits, focused ESLint, TypeScript and `git diff --check`. No target
database migration or business document changes were performed.
