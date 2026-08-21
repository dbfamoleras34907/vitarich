# Notification System Design

Status: **Source implementation created - SQL deployment and authenticated runtime verification pending**

Related diagram: [Notification System Flow](./notification-system-flow.md)

## Current implementation status

Implemented in source:

- Central DOC Placement and Hatchery DOC Dispatch module/event catalog
- Notification rules, transactional outbox, inbox, constraints, RLS, and processing SQL
- Secured rule-management, inbox, read-state, and processing APIs
- Notification Setup UI with audience filters and processing health
- Global notification bell and full inbox page
- Polling fallback, Realtime refresh, shared read state, and client-side ID deduplication
- Atomic DOC Placement and Hatchery DOC Dispatch Posted metadata and outbox enqueue on final source status transitions
- Separate Source FMS and Recipient FMS rule filters for cross-FMS delivery
- Explicit catalog farm routing: DOC Placement uses the committed document farm and Hatchery DOC Dispatch uses the destination farm
- Target-farm recipient filtering through active `users_farms` assignments, with the confirmed Super Admin bypass
- Per-rule Email delivery checkbox, durable email queue, secured server worker, Microsoft Graph OAuth transport, and branded module-aware HTML template

Still required before calling the feature live:

- Apply `app/admin/notifications/notification_system.sql` to Supabase
- Enable the optional scheduled outbox processor or configure an equivalent server worker
- Grant Notification Setup View/Edit permissions to authorized Admin accounts
- Test authenticated Super Admin, Admin, and User scenarios in the browser
- Test posting success, posting errors, duplicate requests, dispatcher downtime, reconnection, and cross-session read synchronization
- Configure the Microsoft Entra application credentials, grant Graph Application `Mail.Send` with admin consent, restrict it to the Vita FMS sender mailbox, and verify authenticated delivery/retry behavior in the deployed Node.js runtime

## Objective

Build one configuration-driven notification platform for all Vitarich business areas. Business modules publish successful business events; the centralized notification system decides whether a rule is active, which users match, and which inbox deliveries to create.

The initial integrations are DOC Receiving and Hatchery DOC Dispatch. Delivery, Clean Up, Breeder, Inventory, Administration, and other modules will reuse the same infrastructure as they are connected.

## Core boundaries

- A notification event key describes a completed business action. It does not execute or trigger the business action itself.
- Post, Edit, and Void operations are the triggers. They publish an event only after the authoritative mutation succeeds.
- Modules do not select recipients or insert directly into per-user inbox tables.
- The centralized dispatcher owns active-rule matching, recipient matching, module View-permission enforcement, delivery creation, retries, and safe no-op behavior.
- Recording a notification event is part of the business transaction.
- Delivering user notifications is an asynchronous, retryable operation after the business transaction commits.
- A notification informs a user. It never grants access to a module or document.

## Central event catalog

Available notification modules and events will be defined in one source catalog:

```text
lib/notifications/catalog.ts
lib/notifications/eventKeys.ts
lib/notifications/types.ts
```

Database access and reusable mutations will follow the repository Data Access Rule:

```text
lib/data/repositories/notifications.ts
lib/data/mutations/notifications.ts
```

The setup page must show only events that are registered and implemented. Administrators must not be allowed to activate a rule for an event that cannot fire.

## Event naming

Use stable uppercase event keys:

```text
<MODULE_KEY>_POSTED
<MODULE_KEY>_EDITED
<MODULE_KEY>_VOIDED
```

Examples:

```text
DOC_RECEIVING_POSTED
DOC_RECEIVING_EDITED
DOC_RECEIVING_VOIDED

DELIVERY_POSTED
DELIVERY_EDITED
DELIVERY_VOIDED

CLEAN_UP_POSTED
CLEAN_UP_EDITED
CLEAN_UP_VOIDED
```

Use past tense because the event is created only after the operation succeeds. User-facing labels can use business-friendly terms such as `Delivery Posting` or `Clean Up Posting`.

### FMS Type and event identity

Do not put the FMS Type in the event key when the same module supports several FMS types. Store the actual FMS Type in the event payload:

```json
{
  "moduleKey": "INVENTORY_GOODS_RECEIPT",
  "eventKey": "INVENTORY_GOODS_RECEIPT_POSTED",
  "fmsType": "Breeder"
}
```

Use an FMS or domain prefix only when the workflows are genuinely different modules with different tables, routes, permissions, or business behavior:

```text
BROILER_DELIVERY_POSTED
BREEDER_DISPATCH_POSTED
HATCHERY_DISPATCH_POSTED
```

Renaming a UI label must not rename an existing persisted module key or event key.

## Standard event contract

Every emitted event provides the available values from this contract:

```ts
type NotificationEventInput = {
  moduleKey: string
  eventKey: string
  entityType: string
  entityId: string | number
  documentNo: string | null
  fmsType: 'Broiler' | 'Breeder' | 'Hatchery' | null
  farmId: number | null
  recipientFarmId?: number | null
  actorAuthId: string
  targetUrl: string | null
  occurredAt: string
  dedupeKey: string
  postingVersion?: number | null
  metadata?: Record<string, unknown>
}
```

Metadata must contain only safe information required for presentation or rule evaluation. Do not include secrets or unnecessary before-and-after field values.

User-facing notification terminology uses **Initiator** for the user who completed the business action. New templates use `{initiator_name}`. The internal `actor_auth_id` field and legacy `{actor_name}` token remain supported for stored-rule compatibility.

Title and message template fields expose a placeholder picker and tooltip. Typing `{` or `{}` opens autocomplete and inserts at the current cursor position. The currently supported user-facing placeholders are `{document_no}` and `{initiator_name}`. The server rejects unknown completed `{placeholder}` tokens so the UI catalog and dispatcher behavior cannot drift.

## Mandatory farm identity contract

`public.farms.id` is the authoritative database identity for a farm. `public.farms.code` is the business-facing identifier and may be retained as a display, integration, and audit snapshot, but a code or farm name must never replace the numeric relationship.

Every farm-scoped business document and every supported Post, Edit, or Void event must follow these rules:

1. Persist a numeric `farm_id` that references `public.farms(id)`.
2. Use `farm_id` for joins, authorization, filtering, rule matching, and notification recipient resolution.
3. Resolve `farm_code` from the same canonical `public.farms` row. Never create it with `String(farm_id)` and never accept an unverified browser-provided ID/code pair.
4. Read the event farm from the successfully persisted source row inside the authoritative server, RPC, or database mutation. Do not use the initiator's `users.default_farm` as the event farm.
5. A user's `default_farm` only preselects a form. The farm actually committed on the document owns the event.
6. A farm-scoped event with a missing or invalid required farm must be marked `Invalid`; it must never fall through to unrestricted delivery.
7. Events intentionally not scoped to a farm must declare `farmRouting: 'none'` in the central event catalog. Missing `farm_id` must not implicitly mean global.

The central catalog must declare one routing mode for every event:

```ts
type NotificationFarmRouting =
  | 'document'
  | 'origin'
  | 'destination'
  | 'origin_and_destination'
  | 'none'
```

Required persisted identities by routing mode:

| Routing mode | Required identity |
| --- | --- |
| `document` | `farm_id` |
| `origin` | `origin_farm_id` |
| `destination` | `destination_farm_id` |
| `origin_and_destination` | Both `origin_farm_id` and `destination_farm_id` |
| `none` | No farm, but the catalog declaration is mandatory |

For cross-farm modules, `farm_id` alone is ambiguous. The source document and event must carry explicit origin and destination IDs. Their corresponding codes may be stored as snapshots, but recipient matching uses the numeric ID selected by the routing mode.

Database enforcement should be added where the business document cannot validly exist without a farm:

```sql
farm_id bigint not null references public.farms(id)
```

When existing legacy rows prevent an immediate `not null` migration, new Post operations must still reject or safely invalidate missing farm identity, and the migration must be tracked before the module is considered notification-ready.

## Farm identity module audit

Audit date: **2026-08-19**

Scope: active operational document routes registered in `NavFolders`, their checked-in TypeScript payloads/queries, and checked-in SQL. Masters, settings, dashboards, and reports are not treated as notification event sources unless they later receive an explicit Post/Edit/Void lifecycle. This is a source audit; the applied Supabase schema, legacy RPC bodies, views, constraints, and existing production rows still require live verification.

### Does not yet follow the direct `farm_id` contract

| Module | Route / source table | Current source behavior | Required correction |
| --- | --- | --- | --- |
| Population Record | `/jmb/growing` / `tbl_growing` | Stores `placement_id`; farm is joined indirectly from `tbl_placement` | Persist and validate direct `farm_id`, or add an authoritative database trigger that stamps it from the locked placement row |
| Growing Grading | `/jmb/growing/grading` / `tbl_grading` | Stores `placement_id`; farm is loaded indirectly and has a farm-name fallback | Persist and validate direct `farm_id`; remove farm-name routing fallback |
| Hatchery Receiving | `/a_dean/receiving` / legacy `insert_receiving` RPC | Uses breeder `soldTo` code and numeric `delivered_to`; no canonical `farm_id` contract is visible in source | Add explicit origin Breeder and destination Hatchery farm IDs and verify both against `public.farms` inside the RPC |
| Egg Storage | `/jmb/eggstorage` / `egg_storage_mngt` | Stores classification reference only | Persist the processing Hatchery `farm_id`; persist origin farm ID too if origin routing is required |
| Egg Pre-Warming | `/jmb/prewarmingv2` / `egg_pre_warming` | Stores egg reference only | Persist and validate the processing Hatchery `farm_id` |
| Egg Setter | `/jmb/eggsetter` / `setter_incubation_process` | Stores free-text `farm_source` instead of a canonical numeric farm relationship | Add `farm_id`; replace notification routing by `farm_source` with the canonical ID |
| Egg Transfer Process | `/jmb/eggtransferv2` / `egg_transfer_process` | Stores free-text `farm_source` and a reference | Add and validate direct `farm_id`; retain `farm_source` only as a display snapshot if needed |
| Egg Hatcher Process | `/jmb/egghatcherv2` / `egg_hatchery_process` | Stores free-text `farm_source` | Add and validate direct `farm_id` |
| Chick Pullout Process | `/jmb/chickpulloutv2` / `chick_pullout_process` | Stores free-text `farm_source` | Add and validate direct `farm_id` |
| DOC Classification | `/jmb/docclassification` / `chick_grading_process` | Stores batch/reference values but no direct farm identity | Add and validate the processing Hatchery `farm_id` and carry forward any required origin farm ID |

These modules must not be connected to farm-targeted notification rules until their farm identity is authoritative. A temporary join through a reference may help a migration backfill, but it is not the long-term event contract.

### Uses a numeric farm ID but is not fully enforced

| Module | Current gap | Required correction before notification readiness |
| --- | --- | --- |
| Egg Classification | Has `farm_id`, but source currently assigns `farm_code = String(farm_id)` | Resolve the real code from `public.farms`; validate an ID/code pair and add/verify the farm foreign key |
| Hatchery DOC Dispatch | Has validated `destination_farm_id`, but no explicit origin Hatchery farm ID | Add `origin_farm_id` before supporting origin or both-farm routing |
| Inventory Transfer | Has one document `farm_id` plus from/to warehouses | If inter-farm transfer is supported, persist or transactionally derive explicit origin and destination farm IDs |
| Item Stock In | `goods_receipt.farm_id` is nullable in checked-in SQL | Make it required for farm-scoped posting or mark missing-farm events Invalid; verify the foreign key live |
| Item Stock Out | `goods_issue.farm_id` is nullable in checked-in SQL | Make it required for farm-scoped posting or mark missing-farm events Invalid; verify the foreign key live |
| DOC Placement | Uses `goods_receipt.farm_id` and now copies it to `recipient_farm_id`, but the source column remains nullable in checked-in SQL | Make the farm required for the business Post; missing farm events are now marked Invalid and cannot become global |
| Growing & Farm Condition | Flock Card carries `farm_id`, but checked-in SQL allows null | Require it for creation/posting and verify the foreign key live |
| Harvest & Delivery | Carries `farm_id`, but checked-in SQL allows null | Require it for Post and read it from the committed header |
| Broiler Clean Up | Carries `farm_id`, but checked-in transaction header SQL allows null | Require it for Post and read it from the committed header |
| Egg Laying Production | Carries nullable `farm_id` and still supports farm-name fallback queries | Require the numeric ID and remove farm-name notification routing fallback |
| Disposal | Sends numeric `farm_id`, but no checked-in table constraint proves the relationship | Verify/add the foreign key and Post-time requirement in Supabase |
| Medication | Sends numeric `farm_id`, but its base table creation/constraint is not checked in | Verify/add `not null references public.farms(id)` in Supabase |

### Source-aligned modules

The following operational modules use a required numeric farm identity in the checked-in source contract. They still need live schema and authenticated Post/Edit/Void verification before activation:

- Breeder Placement (`/jmb/placement`)
- Breeder Dispatch (`/jmb/breederdispatch`)
- Vaccination (`/jmb/vaccination`)

Breeder Clean-Up currently has no implemented operational data path in the checked-in route, so it is not classified as compliant or noncompliant yet. It must adopt this contract when implemented.

### Mandatory readiness gate for future module work

Before registering or activating a farm-targeted notification event, report all of the following:

```text
[ ] Source table has the required numeric farm identity column
[ ] Column references public.farms(id)
[ ] Farm is required for the completed business operation
[ ] Server/RPC/database mutation validates the persisted farm
[ ] farm_code, when stored, resolves from the same farms row
[ ] Event catalog declares document/origin/destination/both/none routing
[ ] Outbox event reads the farm from the committed source row
[ ] Missing required farm becomes Invalid and never global
[ ] Recipient matching uses users_farms.farm_id
[ ] Failed operations emit no event
[ ] Retry dedupe remains deterministic
```

If any required item is unchecked, the module may continue its existing business behavior, but its farm-targeted notification rule must not be exposed as activation-ready.

## Authoritative posting transaction

To guarantee that a posted document always has a corresponding event, the business operation and outbox insertion must commit in the same database transaction.

```text
BEGIN
  Validate authentication and permission
  Validate business rules
  Lock the source document when updating an existing record
  Save the header
  Save detail rows
  Save item lines
  Generate batches or document numbers
  Create required inventory or ledger postings
  Set status, posted_at, posted_by, and posting_version
  Insert the notification outbox event
COMMIT
```

If any step fails:

```text
ROLLBACK
```

The client shows success only after the authoritative RPC or server mutation returns a committed result.

### Required outcome

```text
Posting succeeds
    = business document committed
    + required posting side effects committed
    + notification outbox event committed
```

There must be no state where the document is reported as successfully posted but the system forgot to record its notification event.

## Transactional outbox

The outbox stores durable business events for asynchronous processing. A suggested lifecycle is:

```text
Pending -> Processing -> Processed
                    \-> Failed -> Pending on retry
                    \-> Skipped or Invalid after verification
```

Suggested fields:

```text
id
module_key
event_key
entity_type
entity_id
document_no
fms_type
farm_id
recipient_farm_id
actor_auth_id
target_url
posting_version
metadata
dedupe_key
status
attempt_count
last_error
next_attempt_at
occurred_at
processing_started_at
processed_at
created_at
```

The unique `dedupe_key` prevents the same completed business action from producing duplicate events.

## Source-document verification

Before creating inbox deliveries, the dispatcher verifies that the source document still represents the event being processed:

```text
Source document exists
AND source status is Posted
AND source record is active
AND posting version matches the event
```

If verification fails, the dispatcher creates no user deliveries and marks the event `Skipped` or `Invalid` with a reason.

Only trusted server, RPC, or database mutation paths may enqueue business events. A browser component must not be allowed to claim independently that a document was posted.

## Rule and recipient matching

Notification rules select:

- Module
- Event
- Source FMS Type
- Recipient FMS Type
- User Type
- User Group
- Priority
- Active/inactive status
- Optional exclusion of the triggering user
- Optional Email delivery in addition to the always-enabled in-app inbox
- Whether module View permission is required; planned default is `true`

Recipient matching semantics:

- Multiple selections within one filter use **OR**.
- Different populated filters use **AND**.

Each card in **Configured Rules** has an **Affected Users** tab. The tab is a read-only, on-demand preview of active users who currently match the rule's Recipient FMS, User Type, User Group, and required module View permission. For farm-routed events, regular Admin and User accounts must have at least one active farm assignment and the preview lists those farms; Super Admin shows the farm bypass. The exact recipient list can only be finalized when an event supplies its document, origin, or destination farm. When **Exclude initiator** is enabled, that event's initiator is also removed during dispatch. Opening or refreshing this preview never creates an outbox event, inbox delivery, or email.

The administration page presents **Notification Setup**, **Process Health**, and **Configured Rules** as three top-level tabs so only one workspace is visible at a time. Selecting Edit from a configured rule automatically returns the user to Notification Setup with that rule loaded.

- An empty filter means **Any** for that dimension.
- Only active users are eligible.
- The recipient must have the module's current effective View permission.
- When the event has a recipient farm, the recipient must have an active assignment to that farm; Super Admin remains the hierarchy bypass.

Example:

```text
(Broiler OR Breeder)
AND
(Admin OR User)
AND
(Farm Managers OR Inventory Controllers)
```

## Delivery and inbox

Each matching recipient receives one durable inbox row for the event. Suggested fields:

```text
id
event_id
recipient_user_id
recipient_auth_id
delivered_at
seen_at
read_at
archived_at
```

Enforce uniqueness on:

```text
event_id + recipient_auth_id
```

This makes dispatcher retries safe and prevents duplicate inbox notifications.

## Email delivery channel

In-app delivery is always enabled. Each notification rule has an independent **Email** checkbox. When checked, every recipient selected by that rule receives both one in-app inbox row and one queued email delivery. Email uses `public.users.email`; a missing or invalid user email creates a visible `Skipped` email delivery and does not affect the in-app notification.

The email header is recipient-contextual:

```text
Vita FMS · Broiler
Vita FMS · Breeder
Vita FMS · Hatchery
```

For a Super Admin without a canonical FMS Type, the single Recipient FMS filter is used when available, followed by the event FMS as fallback.

The default transport remains Office 365 authenticated SMTP using the existing `OUTLOOK_EMAIL` and `OUTLOOK_PASSWORD` server environment variables. Microsoft Graph OAuth is available only when explicitly selected and requires these server-only environment variables:

```text
EMAIL_TRANSPORT=microsoft-graph
MICROSOFT_GRAPH_TENANT_ID=<Microsoft Entra tenant ID>
MICROSOFT_GRAPH_CLIENT_ID=<application client ID>
MICROSOFT_GRAPH_CLIENT_SECRET=<application secret value>
OUTLOOK_EMAIL=<licensed sender mailbox>
```

The Entra application requires Microsoft Graph **Application** permission `Mail.Send` and tenant-admin consent. Because that permission can otherwise send as any mailbox, Exchange Online application RBAC should restrict the application to the mailbox in `OUTLOOK_EMAIL`. The mailbox display name should be configured as `Vita FMS`; Graph controls the envelope display name. `EMAIL_TRANSPORT=smtp` may be set explicitly, but SMTP is also selected when `EMAIL_TRANSPORT` is absent.

`NOTIFICATION_EMAIL_EXCLUDED_ADDRESSES` accepts a comma- or semicolon-separated list of recipient addresses that must retain in-app delivery but skip the email channel. Excluded claimed rows transition to `Skipped` and are not retried.

The branded HTML template includes only committed event information:

- Notification module and event type
- Document number
- Routed farm code and name
- Total document quantity and line count when supported
- DOC Placement actual received, DOA, and reject totals
- Initiator shown as `Posted by` for the current Posted events
- Original posting date and time in Asia/Manila

No source-document link is included while notification navigation remains disabled.

Email is asynchronous and has its own lifecycle:

```text
Pending -> Processing -> Sent
                    \-> Failed -> retry
                    \-> Skipped when recipient email is invalid
```

Normal background processing and **Process due** honor `next_attempt_at`. Authorized Notification Setup editors can use **Retry failed emails now** to move current Failed rows to immediate eligibility and run one attempt without creating replacement queue rows.

The unique identity is `event_id + recipient_auth_id`. This prevents double login, repeated processing, and ordinary worker retries from creating a second queued email. The same deterministic application message identity is sent as a custom Graph header on every retry. Microsoft Graph returns acceptance rather than final delivery confirmation, so the queue retains at-least-once delivery semantics with deterministic identity.

## Offline and failure behavior

### User connection is lost before the request reaches the database

- The document is not posted.
- No outbox event exists.
- The client may retry with the same idempotency key.

### Transaction fails during posting

- The complete transaction rolls back.
- The document is not considered posted.
- Required lines, inventory postings, and related changes roll back.
- No outbox event exists.
- No notification is delivered.

### Transaction commits but the client loses the response

- The posted document and outbox event both exist.
- The client reconciles using the same idempotency key.
- A retry returns the existing successful result instead of posting again.

### Dispatcher or notification processing is unavailable

- The document remains posted.
- The outbox event remains `Pending` or `Failed`.
- The dispatcher retries after service or connectivity recovery.
- Notification delivery failure never reverses a committed business posting.
- Email remains Pending or Failed and retries independently; the in-app delivery remains available.

### Recipient is offline

- The inbox delivery remains unread in the database.
- When the application reconnects, polling or realtime refresh loads the unread notification and updates the bell count.

### No active rule matches

- The dispatcher performs a safe no-op.
- The outbox event is marked processed with no deliveries.
- The completed business action is unchanged.
- Activating a rule later does not retroactively notify old events unless an explicit replay feature is used.

## Retry policy

Initial planned retry schedule:

```text
Immediately
After 1 minute
After 5 minutes
After 15 minutes
After 1 hour
Then hourly until the configured administrative limit
```

The dispatcher processes records where:

```text
status is Pending or retryable Failed
AND next_attempt_at <= current time
```

Processing should claim events safely so concurrent workers cannot deliver the same event twice. Failed events must retain `attempt_count` and `last_error` for administration and troubleshooting.

## Original time and delivery time

Store both timestamps:

```text
occurred_at  = when the business action committed
delivered_at = when the recipient inbox row was created
```

User-facing relative time is based on `occurred_at`. A delayed notification may show both values in its details:

```text
Posted at 10:00 AM
Delivered at 11:00 AM
```

## User experience

The global application shell will provide:

- Notification bell
- Unread-count badge
- All and Unread filters
- Priority and module indicator
- Relative event time
- Mark as read
- Mark all as read
- Link to the source document
- Full notification inbox page

Opening a notification runs route authorization again. If the user's permission was removed after delivery, the source document remains inaccessible.

## Security

- Users may read and update read state only for their own inbox deliveries.
- Business modules cannot select recipients.
- Clients cannot insert trusted posted/edited/voided events directly.
- Rule configuration uses secured server APIs and the existing explicit user hierarchy.
- Super Admin bypass and Admin FMS restrictions must remain consistent with existing authorization behavior.
- Notification Setup must be registered in `NavFolders` and governed by the same effective View/Edit permission checks as sidebar, Global Search, and direct-route authorization.

## DOC Receiving first integration

The planned first event set is:

```text
DOC_RECEIVING_POSTED
DOC_RECEIVING_EDITED
DOC_RECEIVING_VOIDED
```

Only operations actually supported by the module will be registered and exposed. The implementation must not invent Edit or Void business behavior merely to create notification events.

The source integration atomically stamps posting identity and inserts the outbox event in the same database transaction as the final `goods_receipt.status` transition. Therefore, a failed final Posted transition cannot create an event without the Posted status, and a successful transition cannot omit the event.

The catalog declares `farmRouting: 'document'`. The outbox copies the committed `goods_receipt.farm_id` into both `farm_id` and `recipient_farm_id`. Before delivery, the dispatcher confirms that the posted source row, posting version, event farm, and recipient farm still agree. A missing or mismatched farm marks the event Invalid. Regular Admin and User recipients must have an active `users_farms` assignment to that farm; Super Admin retains the confirmed hierarchy bypass.

The DOC Placement outbox metadata calculates committed line count, total received quantity, actual received quantity, DOA quantity, and reject quantity from `goods_receipt_doc`. These values populate the email template when Email is enabled on the winning rule.

The wider `saveGoodsReceipt()` implementation still performs multiple separate browser-side Supabase mutations before that final transition. A future authoritative RPC/server mutation is still required to make the entire header, detail, batch, inventory, status, and event operation all-or-nothing. Until then, earlier failures can leave a partial Draft, but they cannot create a false Posted notification because the final status transition never occurs.

## Hatchery DOC Dispatch cross-FMS integration

Hatchery DOC Dispatch now has an explicit `Draft` to `Posted` lifecycle. Header and line saves remain Draft operations and cannot notify. The separate Posted status update atomically stamps `posted_at`, `posted_by`, and `posting_version` and inserts:

```text
HATCHERY_DOC_DISPATCH_POSTED
```

The destination list comes from the canonical `public.farms` master used by `/a_dean/farm`, restricted to active, approved records with `farm_type = 'BR'`. The event uses Source FMS `Hatchery`, carries the canonical destination farm as `recipient_farm_id`, requires `Menus` / `DOC Placement/view`, and links to DOC Receiving. A matching rule can select Recipient FMS `Broiler`; only active matching users assigned to the destination farm receive an inbox row. If draft saving succeeds but posting fails, the draft remains available and no notification event exists.

The catalog declares `farmRouting: 'destination'`. Regular Admin and User recipients must be actively assigned to `destination_farm_id`; Super Admin retains the confirmed farm-assignment bypass. A missing destination farm or a mismatch between the source dispatch and outbox event is marked Invalid and cannot become an unrestricted delivery.

The Hatchery DOC Dispatch outbox metadata calculates committed line count and total quantity from `dispatch_doc_item`. These values populate the email template when Email is enabled on the winning rule.

## Planned implementation order

1. Create notification database tables, constraints, indexes, policies, and secured processing functions.
2. Create the central module/event catalog and TypeScript contracts.
3. Create shared notification repositories and mutations.
4. Create secured rule-management and inbox APIs.
5. Register Notification Setup and Notification Inbox permissions in `NavFolders`.
6. Build the Notification Setup UI.
7. Build the global bell and inbox UI.
8. Implement outbox claiming, matching, delivery, retries, and operational visibility.
9. Refactor DOC Receiving posting into a transactional authoritative mutation.
10. Wire and verify supported DOC Receiving Post/Edit/Void events.
11. Connect other modules incrementally using the same contract.

## Planned access defaults requiring final confirmation

- First delivery channel: in-app only.
- Existing one User Group per user remains unchanged.
- Super Admin may configure rules for all FMS types.
- Admin may configure source events only for its own FMS when granted Notification Setup permission. Recipient FMS may differ, while Admin remains restricted to regular-User audiences.
- Regular User cannot configure notification rules.
- Module View permission is required for delivery.
- Excluding the triggering user is configurable; the default still needs confirmation.

## Acceptance criteria

- A successful posting commits both the document and one outbox event.
- A failed or rolled-back posting creates no outbox event or inbox delivery.
- Losing the client response after commit does not duplicate the posting or event on retry.
- Dispatcher downtime delays delivery without losing the event or reversing the document.
- Recipient downtime preserves an unread inbox record until reconnection.
- No active matching rule is a safe no-op.
- The same event cannot create duplicate deliveries for one recipient.
- Email is created only when the winning matching rule has Email enabled and cannot create more than one queue row per event and recipient.
- Recipient matching follows Source FMS, Recipient FMS, the catalog-selected document/destination farm, User Type, User Group, active-user, and current View-permission rules. Super Admin retains the confirmed farm-assignment bypass.
- Clicking a notification rechecks route authorization.
- Static checks, applied SQL, authenticated role tests, browser behavior, retry recovery, and live Supabase behavior are reported separately.
