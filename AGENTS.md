# Vitarich Repository Instructions

## Core Rule: Reuse First

Before creating any function, component, hook, query, mutation, API handler, or Supabase function:

1. Search the codebase for an existing implementation.
2. Reuse it if it already fits.
3. Extend it with typed parameters when the difference is small.
4. Create something new only when the behavior is materially different.
5. New functions must be designed to be reusable, not tied to one page or component.

This applies to:

* TypeScript functions
* React components
* Hooks
* Supabase queries
* Supabase RPC/database functions
* Server actions
* API calls
* SQL
* Data transformations
* Validation helpers

Avoid duplicate implementations.

Prefer shared locations such as:

```text
lib/
  data/
    repositories/
    queries/
    mutations/
    query-keys/
  functions/
  utils/
components/
```

Route-local files and UI components should call shared reusable functions instead of recreating logic.

Do not create generic arbitrary table/query executors.

---

## Browser Rule

Do not use or check the in-app browser for this repository unless explicitly requested.

Use:

* source inspection
* static checks
* tests
* explicitly authorized read-only data verification

Do not repeatedly report that browser access is unavailable.

---

## Supabase / Data Access

Before creating a Supabase query, RPC, SQL statement, fetch, axios call, server loader, or React data-loading hook:

1. Search for an existing shared implementation.
2. Reuse or extend it where possible.
3. Keep reusable data access in the shared data layer.
4. Preserve:

   * RLS
   * authentication behavior
   * client/server boundaries
   * TypeScript types

Do not duplicate Supabase queries across pages/components.

When creating a Supabase/PostgreSQL function, design it for reuse with clear typed parameters rather than creating multiple nearly identical functions.

Avoid `jmb` and `_baja` unless explicitly requested.

---

# Notification Readiness

When creating or materially changing a business module, inspect all supported:

* Post
* Edit
* Void

operations for notification readiness.

Business modules publish events. They must **not** determine notification recipients.

An inactive or unmatched notification rule must result in a safe no-op.

## Event Keys

Use the centralized notification event catalog.

Use stable keys:

```text
<MODULE_KEY>_POSTED
<MODULE_KEY>_EDITED
<MODULE_KEY>_VOIDED
```

Reuse existing keys. UI/module label changes must not rename persisted event keys.

Emit only one event per completed user action.

Do not emit events for:

* renders
* field changes
* autosaves
* retries
* intermediate updates

---

## Event Contract

Provide available values through the centralized dispatcher:

```ts
{
  moduleKey
  eventKey
  entityType
  entityId
  documentNo
  fmsType
  farmId
  actorAuthId
  targetUrl
  occurredAt
  dedupeKey
  metadata?
}
```

Valid FMS types:

```text
Broiler
Breeder
Hatchery
```

`metadata` must not contain secrets or unnecessary before/after data.

---

# Farm Identity

`public.farms.id` is the authoritative farm identity.

Farm-scoped business documents must persist numeric:

```text
farm_id -> public.farms(id)
```

Use `farm_id` for:

* relationships
* authorization
* filtering
* notifications
* recipient matching

`farm_code` and `farm_name` are display/business snapshots only.

Never:

```ts
farm_code = String(farm_id)
```

Never trust an unverified browser-provided farm ID/code pair.

`users.default_farm` may preselect a form but must not determine the notification farm.

Read the farm from the successfully persisted document.

---

## Farm Routing

Every notification event must declare one routing mode:

```text
document
origin
destination
origin_and_destination
none
```

Required fields:

```text
document               -> farm_id
origin                 -> origin_farm_id
destination            -> destination_farm_id
origin_and_destination -> origin_farm_id + destination_farm_id
```

Cross-farm modules must not overload one `farm_id` for both sides.

If a required farm ID is missing, invalid, or inconsistent with the persisted record:

```text
event = invalid
```

Never convert missing farm information into global notification delivery.

Recipient farm matching should use active:

```text
users_farms.farm_id
```

---

# Notification Integration

Emit/enqueue events only from the authoritative:

* server mutation
* RPC
* database mutation
* shared repository/mutation function

Do not use React click handlers or success toasts as notification hooks.

Never emit before persistence succeeds.

Prefer:

```text
business transaction
    ↓
business change
    +
notification outbox
```

inside the same transaction.

If transactional integration is unavailable:

1. confirm persistence first
2. emit afterward
3. use a deterministic `dedupeKey`

Retries must not create duplicate events or deliveries.

Business modules must not query notification rules or resolve recipients.

The centralized notification system owns:

* rule matching
* FMS Type matching
* User Type matching
* User Group matching
* farm matching
* View permission checks
* recipient resolution
* delivery creation
* no-rule no-op behavior

Do not insert directly into user notification/inbox tables from business modules.

Notification work must not alter existing:

* calculations
* validations
* approvals
* permissions
* numbering
* persistence behavior
* status behavior

---

# Module Audit

Before connecting an existing module to notifications, inspect:

```text
persisted header
shared mutations
Post path
Edit path
Void path
SQL/RPC functions
farm fields
```

A route parameter, display farm name, warehouse, source reference, or parent document does not prove authoritative farm ownership.

Modules marked incomplete in:

```text
docs/notification-system-design.md
```

must not be treated as farm-notification-ready until their recorded issues are fixed.

---

# Completion Check

For changed Post/Edit/Void operations verify:

1. Module/event keys are registered.
2. Events originate from the successful persistence path.
3. `dedupeKey` is deterministic.
4. Failed operations emit nothing.
5. Retries do not duplicate events.
6. No matching rule results in a safe no-op.
7. Farm routing mode is declared.
8. Required farm IDs resolve to `public.farms(id)`.
9. Missing farm IDs never become global delivery.

If shared notification catalog, dispatcher, or outbox infrastructure is missing, do not create a module-local replacement.

Create/reuse centralized reusable infrastructure when it is within scope.
