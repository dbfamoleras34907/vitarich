# Receiving source integration

Copy From connects Breeder Dispatch to Hatchery Receiving and Hatchery DOC Dispatch to Broiler DOC Placement. It offers posted dispatch lines for the destination farm and tracks their remaining base quantity. One receiving detail can allocate several source lines; partial receipts are supported. The server locks source documents and validates availability again on posting.

Breeder stock is not batch managed. Its lineage is dispatch line → breeder placement ID and placement date. New Hatchery receiving batches use the placement date as inventory `ref2`; the legacy `ref` remains available to classification. Broiler receipt `ref2` carries the dispatched DOC batch. Existing cycle consolidation and disposal references keep their established meanings. Quantities from dispatch are already base quantities, including dispatches labelled BOX or TRAY, and are not converted again.

New receipt batches use the existing automatic batch rules and series. Without a matching rule they use the Item Stock In `FD`/production date/optional expiry/sequence fallback. Allocation is serialized and numbers are fresh across receiving documents. Invalid explicitly selected rules fail rather than silently selecting another rule. A receiving SKU and production date still require entry where the dispatch does not provide them.

Existing documents offer Link Source. The selected quantities must reconcile with their saved receiving quantities, and links consume source availability. Linking retains existing batches and stock postings; the migration does not infer historical links or rewrite historical inventory. A dispatch with linked receiving lines cannot be changed or reversed. Hatchery receiving continues its existing inventory-at-line-insert behavior; its approval submission now commits atomically with the receipt.

## Deployment

Apply checked-in SQL to the verified application database before deploying the changed application:

1. `app/admin/notifications/notification_system.sql` (updated centralized dispatcher).
2. `app/inv/doc-receiving/receiving_sources.sql`.
3. `app/inv/doc-receiving/receiving_dispatch_transactions.sql`.
4. `app/inv/doc-receiving/receiving_source_notifications.sql`.

The existing receiving schema, approval function, dispatch destination-farm migrations and `app/inv/gr/gr_inventory_postings.sql` posting implementation are prerequisites. Validate their target versions before applying. No SQL was applied to Supabase as part of implementation. Local schema fixtures do not establish hosted schema, RLS or authenticated-session compatibility.

## Notification readiness

All four module keys register `_POSTED`, `_EDITED`, and `_VOIDED` events. Their catalog activation remains disabled pending target deployment and verification.

| Module key | Routing | Persisted canonical farm |
| --- | --- | --- |
| `BREEDER_DISPATCH` | document | `tbl_brd_dispatch.farm_id` |
| `HATCHERY_RECEIVING` | document | `recieving.farm_id` |
| `HATCHERY_DOC_DISPATCH` | destination | `dispatch_doc.destination_farm_id` |
| `DOC_RECEIVING` | document | `goods_receipt.farm_id` |

Deferred database triggers call `capture_receiving_flow_event` at successful transaction completion. They compare final persisted header/line snapshots and enqueue one centralized outbox event with `RECEIVING_FLOW:<MODULE>:<document ID>:<revision>`. Rollbacks enqueue nothing; identical retries and repeated voids do not create duplicate events. Persisted revision records validate event identity, actor, time and source farm. Recipient resolution remains in the central dispatcher, requires numeric active `users_farms.farm_id` assignments and module View permission, and safely produces no delivery without an active matching rule.

Farm IDs resolve to `public.farms(id)`. Missing/invalid required farms mark events invalid, never global. Historical Hatchery documents and legacy approval-created receipts without a canonical farm remain blocked from notification delivery until their farm identity is explicitly reconciled. Draft creation emits no Post; a persisted draft edit emits Edit. Physical draft deletion is not a Void transition.

Before activation, verify Post/Edit/Void with real authorized sessions, source/destination assignments, missing-farm rejection, retry deduplication, approval behavior and the no-rule case on the target database. Local tests exercise the dispatcher, but do not substitute for these deployment checks.

## Verification

See `scripts/database/tests/receiving-sources/README.md` for the disposable PostgreSQL suite. It covers partial receipts, base quantities, multiple source batches, preserved cycle consolidation, historical linking without stock changes, failed-save rollback, stale drafts, concurrent over-receiving, source mutation guards, permissions, missing farms, no-rule dispatch and event/recipient deduplication. TypeScript passes. Existing lint errors remain in the legacy Hatchery screens and shared types; the new shared source components and changed DOC/dispatch paths pass focused lint.
