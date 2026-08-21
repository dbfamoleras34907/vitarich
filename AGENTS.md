# Vitarich Repository Instructions

## Data Access Rule

Before creating any Supabase query, SQL statement, API request, fetch call, axios call, server action data loader, or React data-loading hook:

1. Search the codebase for an existing implementation.
2. Reuse the existing repository/data-access function if it already fits.
3. Extend the existing function with typed parameters when the difference is minor.
4. Create a new query only when the operation has materially different:
   - authorization rules
   - selected fields
   - joins
   - filters
   - business behavior
   - return type
5. New reusable queries must live in the shared data-access layer, preferably:
   - `lib/data/repositories`
   - `lib/data/queries`
   - `lib/data/mutations`
   - `lib/data/query-keys`
6. Route-local `api.ts`, components, hooks, and pages should call shared functions instead of recreating queries.
7. Do not create generic arbitrary table/query executors.
8. Preserve Supabase RLS, auth behavior, client/server boundaries, and TypeScript types.
9. Avoid `jmb` and `_baja` unless explicitly asked.

## Mandatory Notification Event Readiness

The notification system is configuration-driven. Business modules publish events; they do not decide who receives notifications. An inactive or unmatched notification rule must make event dispatch a safe no-op.

Whenever creating or materially changing a business module, inspect every supported **Post**, **Edit**, and **Void** operation. Before considering the module work complete, prepare each supported operation for notification activation, even when the current request directly changes only one of those operations.

### Required event contract

- Register supported events in the centralized notification event catalog. Never use labels, route names, or ad hoc strings as event identity.
- Use stable uppercase event keys: `<MODULE_KEY>_POSTED`, `<MODULE_KEY>_EDITED`, and `<MODULE_KEY>_VOIDED`.
- Reuse an existing module/event key when one already exists. Renaming a module label must not rename its persisted event key.
- Emit one event for each completed user action, not for every field change, line update, render, autosave, or retry.
- An Edit event represents a successful persisted edit of an existing document. Include changed-field names when they can be determined safely; do not include secrets or unnecessary before/after values.
- A Void event represents the successful transition from active to void. Repeated requests against an already-void document must not produce additional events.

Every emitted event must provide the centralized dispatcher with the available values from this contract:

- `moduleKey`
- `eventKey`
- `entityType`
- `entityId`
- `documentNo`
- `fmsType`
- `farmId`
- `actorAuthId`
- `targetUrl`
- `occurredAt`
- `dedupeKey`
- optional safe `metadata`

Use canonical FMS values: `Broiler`, `Breeder`, and `Hatchery`.

### Mandatory farm identity requirements

- `public.farms.id` is the authoritative farm identity. Every farm-scoped business document must persist a numeric `farm_id` that references `public.farms(id)`.
- Use `farm_id` for relationships, authorization, filtering, notification routing, and recipient matching. `farm_code` and `farm_name` are business/display snapshots only and must not replace the numeric relationship.
- Resolve any stored `farm_code` from the same canonical `public.farms` row. Never set `farm_code` to `String(farm_id)` and never trust an unverified browser-provided farm ID/code pair.
- A user's `users.default_farm` may preselect a form, but it must never determine the notification event farm. Read the farm from the successfully persisted business document.
- Register every event with an explicit farm-routing mode: `document`, `origin`, `destination`, `origin_and_destination`, or `none`. Missing farm data must not implicitly mean a global event.
- `document` routing requires `farm_id`; `origin` requires `origin_farm_id`; `destination` requires `destination_farm_id`; `origin_and_destination` requires both IDs. Cross-farm modules must not overload one ambiguous `farm_id` for both sides.
- The dispatcher must mark an event `invalid` when its catalog routing mode requires a farm and the required farm ID is missing, invalid, or does not match the persisted source row. It must never broaden that event to unrestricted delivery.
- Recipient farm matching must use active `users_farms.farm_id`. A farm-code lookup may be retained only as a documented legacy fallback while old assignments are migrated.
- Before connecting an existing module, audit its persisted header, shared mutation, Post/Edit/Void paths, and checked-in SQL. A route field, display name, source reference, warehouse, or inherited parent record does not by itself prove that the module persists an authoritative farm ID.
- Modules listed as noncompliant or partially enforced in `docs/notification-system-design.md` must not expose farm-targeted notification rules as activation-ready until their recorded farm-identity gaps are resolved and verified.

### Transaction and integration rules

- Emit or enqueue the event from the authoritative server, RPC, or database mutation path. A React click handler or success toast is not an authoritative notification hook.
- Never emit before the business mutation succeeds. Prefer writing a transactional notification outbox record in the same transaction as the business change.
- If the current mutation cannot be made transactional, dispatch only after confirmed persistence and use a deterministic `dedupeKey` so a retry cannot create duplicate recipient notifications.
- Do not scatter recipient resolution across modules. Modules must not query notification rules, FMS Type, User Type, User Group, or individual recipients to decide delivery.
- The centralized dispatcher owns active-rule matching, recipient resolution, module View-permission enforcement, delivery creation, and the no-active-rule no-op.
- Do not insert directly into per-user inbox/delivery tables from a business module.
- Notification delivery must never announce a failed or rolled-back Post, Edit, or Void operation.
- Do not change existing Post/Edit/Void calculations, validation, approvals, permissions, persistence, document numbering, or status behavior merely to add notification readiness.

### Completion checks

For every supported Post/Edit/Void path that was added or materially changed, verify and report:

1. The registered module key and event keys.
2. The authoritative successful-commit location that emits or enqueues each event.
3. The deterministic deduplication identity.
4. That failed operations emit nothing.
5. That retries do not duplicate the same event or recipient delivery.
6. That no active matching notification rule results in a safe no-op without changing the business outcome.
7. The event's declared farm-routing mode and the persisted source columns used for that routing.
8. That every required farm ID resolves to `public.farms(id)` and a missing required farm cannot become a global delivery.

If the centralized catalog, dispatcher, or outbox does not exist yet, do not create a module-local substitute. State the missing shared dependency and add the reusable centralized infrastructure within the requested scope, or stop and ask before materially expanding the task.
