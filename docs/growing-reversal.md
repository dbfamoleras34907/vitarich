# Growing reversal

`/brd/fc` exposes **Reverse Growing** for Super Admin (`users.user_type = 1`) when an active Growing header exists. A reason and explicit confirmation are required. The server rechecks authorization and the persisted building cycle. Active Harvest and Clean Up drafts/posts for the building and cycle block reversal; cancelled records do not. Matching follows the existing cycle report: warehouse identity plus the consolidated cycle batch or placement item/batch. An unfinished draft with no batch blocks its building conservatively.

The RPC reverses mortality and feed intake from latest age to earliest, voids every active Growing header/row for the placement, and retains the cycle, placement, DOC origins, and building occupancy. Original headers, rows and allocations are preserved in an RLS-protected audit receipt with actor, timestamp and reason. Existing nonzero thinning blocks the action because thinning is outside the requested scope.

The migration also fixes mortality reversal deduplication to include the originating row. Without that fix, equal quantities at different ages could be treated as already reversed.

## Deployment

Apply `app/brd/fc/reverse_brd_fc_transaction.sql` after the existing Growing schema, `app/brd/fc/new/save_brd_fc_transaction.sql`, and `app/admin/notifications/notification_system.sql`. The migration includes the updated shared mortality functions and notification dispatcher. Deployment itself does not reverse any business records. This migration has been applied only to disposable local test databases, not the target Supabase database. The workspace has no direct target PostgreSQL connection configured.

The administrative reversal takes transaction-scoped write locks on Growing, placement, Harvest and Clean Up tables, including their lines, so legacy writers cannot race eligibility checks. Reads continue; other writes may briefly wait. The existing farm advisory lock serializes it with Growing saves. Test target concurrency and deployed RLS before enabling notification rule activation.

## Notification readiness

All Growing events use module `BRD_FC`, FMS `Broiler`, routing mode `document`, and persisted `brd_fc.farm_id` joined to `public.farms.id`. The dispatcher validates the source entity and both event farm IDs; missing or mismatched farms become `invalid`, never unrestricted delivery. The catalog remains `ruleActivationReady: false` pending deployment verification.

| Operation | Event | Successful mutation hook | Deduplication |
| --- | --- | --- | --- |
| First save | `BRD_FC_POSTED` | `enqueue_brd_fc_save_event` on the transactional save receipt | Event key + save request UUID |
| Persisted edit | `BRD_FC_EDITED` | Same save receipt trigger; individual row reversals use `enqueue_brd_fc_reversal_event` | Save request UUID; individual reversal uses row ID + transaction ID |
| Full reversal | `BRD_FC_VOIDED` | Final outbox insert in `reverse_brd_fc_transaction`, after all inventory/row/header changes | `BRD_FC_VOIDED:<original growing ID>`; protected receipt returns the prior result on retry |

Full reversal suppresses individual row edit notifications using its protected transaction receipt, yielding one event for the completed user action. No recipient resolution occurs in the module. Failed operations roll back inventory, business rows, receipts and outbox together. The centralized dispatcher creates no deliveries when no active rule matches, and unique event/recipient identities prevent duplicate deliveries. Existing Post/Edit calculations and validation remain unchanged.

## Verification performed

- Full TypeScript check passed. Focused ESLint passed with three existing unused-symbol warnings in the list page. `git diff --check` passed.
- Disposable PostgreSQL tests exercised Super Admin enforcement, authenticated RPC execution without direct table grants, active Draft/Posted Harvest and Clean Up blockers, an older cycle in the same building, cancelled Clean Up, and an injected failure after a later age had reversed.
- Verified rollback of earlier changes, restoration of bird/disposal/feed balances across equal mortality quantities at different ages, retention of placement/cycle/DOC origins, audit snapshots, and voided Growing rows.
- Verified one full-reversal outbox event, safe no-rule dispatch, one delivery under an active test rule, retry deduplication, and rejection of missing event farm identity.
- Verified retrying an old reversal does not reverse newly created Growing for the retained cycle. Existing Growing save regression tests passed for rollback, warehouse item validation, save retry deduplication and changed-request rejection.

Reproduce with `scripts/database/tests/growing-reversal/prepare_fixture.py` and `assertions.sql` against a new disposable database. Fixtures use canonical reversal functions and dispatcher with minimal supporting schema. These results do not establish deployed Supabase behavior.
