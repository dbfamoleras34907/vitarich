# Farm profile fields

Farm Edit and the Farm Setup Wizard share `app/a_dean/farm/setup/Layout.tsx`.
Production Model, Island, and Region are shown there, in the wizard review, and
in the Farm Management list (the existing farm view). They are optional, with
no inferred defaults for existing farms. Region lists all 18 PSA regions,
including NIR: https://psa.gov.ph/classification/psgc/regions.

Values persist on `public.farms` as `production_model`, `island`, and
`administrative_region`. The historical `region` column continues to store
province data. Existing `get_farm_full` and Farm Management repository reads
already return the full farm row, so no additional data loader is needed.
Omitted profile keys in an older wizard update payload preserve saved values.

Apply `app/a_dean/farm/apply_farm_profile.psql` with psql against the intended
database. It installs the columns, notification hook, and wizard RPCs in one
transaction and stops on failure. Its header lists existing schema prerequisites.
For SQL Editor deployment, execute those four included SQL files in the same
order, enclosed in one transaction. Database deployment and live persistence
have not been verified in this change.

## Notification source audit

- Existing catalog module `FARM` registers `FARM_POSTED`, `FARM_EDITED`, and
  `FARM_VOIDED`, all with `document` routing.
- `enqueue_farm_event()` runs from the farm table's AFTER trigger inside the
  business transaction. Approved insertion/approval emits Post; persisted edits
  emit Edit; active-to-void emits Void. The existing `void_farm` RPC also enqueues
  Void with the same key. New profile changes are included in `changedFields`.
- Post and Void dedupe keys are event key plus farm ID. Edit uses event key plus
  farm ID plus transaction ID. The unique outbox key collapses events within the
  same transaction; delivery uniqueness is `(event_id, recipient_auth_id)`.
  **Existing limitation:** a separately retried Edit RPC uses a new transaction
  ID and updates `updated_at`, so cross-request Edit deduplication is not proven
  or guaranteed. This change does not claim full retry readiness.
- A rolled-back business transaction rolls back its outbox writes too.
- Both event farm columns come from the persisted `farms.id`, the canonical
  farm identity. The outbox references `public.farms(id)`. The shared dispatcher
  checks source ID, FMS, and both farm IDs; missing or mismatched identities are
  marked Invalid before matching recipients, never treated as global.
- The shared dispatcher matches active rules and authorized recipients; no
  matching active rule inserts no deliveries and leaves the business outcome
  unchanged. Reprocessing an event cannot duplicate its recipient delivery.
- Evidence is source inspection only; live rollback, RLS, dispatch, and retry
  behavior require database verification before claiming production readiness.
