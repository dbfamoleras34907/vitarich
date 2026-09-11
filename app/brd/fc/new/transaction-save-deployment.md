Growing save transaction
=======================

The former browser sequence committed the header and age rows before calling
feed-intake RPCs. An RPC failure therefore left a partially saved Growing record.
`saveFlockCard` now calls the shared `saveBroilerGrowingTransaction` repository,
which sends one `save_brd_fc_transaction` request. There is no sequential-write
fallback if the new RPC is missing.

Deployment
----------

1. Apply the current `app/admin/notifications/notification_system.sql` so the
   dispatcher validates BRD_FC events against persisted `brd_fc.farm_id`.
2. Apply `../settings/brd_fc_settings.sql` to make Feed Group optional.
3. Apply `save_brd_fc_transaction.sql`. This also replaces the seven-argument
   feed-intake function, using the selected `items.id` and the persisted farm feed warehouse, and reloads the PostgREST schema cache. Existing Growing and item
   hierarchy schema must already be installed.
4. Deploy the application changes. Verify with an authorized user that a valid
   feed batch saves, and that an invalid batch leaves all pre-save values intact.

The migration does not remove data left by earlier failed saves. Inspect those
records and inventory postings before deciding whether a reversal is needed.

Notification readiness
----------------------

- Catalog module: `BRD_FC`. Events: `BRD_FC_POSTED` for the first save and
  `BRD_FC_EDITED` for an existing save or feed/mortality reversal. This Growing
  editor has no whole-document Void operation.
- Save events are enqueued by `enqueue_brd_fc_save_event`, triggered by the
  receipt insert after all ages and feed RPCs succeed, in the same transaction.
  Failures roll back the receipt and event with the business changes.
- Save deduplication is `eventKey:requestId`. A repeated request returns the
  original result; a changed payload with the same request ID is rejected.
  The client retains the request identity across retries in the current page.
- Reversal events come from `enqueue_brd_fc_reversal_event`, using the line ID
  and transaction ID. Repeating an already completed reversal changes no feed
  or mortality values and emits nothing.
- Routing is `document`, with the numeric `brd_fc.farm_id` resolved against
  `farms.id`. The transaction requires a Broiler farm and canonicalizes its
  code/name. The dispatcher rejects a missing or mismatched source farm.
- The existing dispatcher owns rules, permissions and delivery deduplication;
  no active matching rule is its existing skipped/no-delivery path. No recipient
  queries or delivery inserts were added to Growing.
- Rule activation remains hidden (`ruleActivationReady: false`) pending target
  deployment and live farm/FK verification. Legacy rows can still have null
  farm IDs; this migration does not guess a farm for them.

Validation
----------

Disposable PostgreSQL tests cover the real feed function, the transaction RPC,
outbox triggers, warehouse item selection without Feed Group, failed insert and later-age edit
rollback, and repeated requests. Mortality effects are represented by a probe
trigger. This does not establish production RLS, production inventory-trigger
behavior, notification delivery, or the supplied batch's live item mapping.

Feed Type now selects an active item with positive batch stock in the farm feed
warehouse. The existing RPC argument `p_feed_type_id` now carries `items.id`;
application and SQL must be deployed together. New rows store `extra.feedItemId`,
`feedItemCode`, and `feedItemName`. Historical group IDs are not interpreted as
item IDs; saved rows display the item names from their persisted allocations.
