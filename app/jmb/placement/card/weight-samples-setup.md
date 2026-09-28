# Breeder weight samples

In Population Record, open **Weight Samples**, choose the weighing date, enter or
paste 50 positive gram weights in each sex's column, and click **Save Samples**.
Reopen the same date to view or edit the saved values. Each date belongs to one
placement/pen. Samples save independently of Population Record drafts and Post.
The existing daily weight and uniformity fields are not changed.

Uniformity is the percentage within the inclusive ±10% range of the sex's
unrounded mean. This follows the [Cobb Breeder Management Guide](https://www.cobbgenetics.com/assets/Cobb-Files/80a75d5bbe/Breeder-Management-Guide.pdf)
calculation, using the user-requested sample size of 50. There is no inferred
sample count for historical manually entered percentages.

## Install

1. Ensure the current `app/admin/notifications/notification_system.sql` is installed.
2. Run `app/jmb/placement/card/breeder_weight_samples.sql` in Supabase SQL Editor.
   It creates the table, calculated columns, RLS, transactional save RPC, and patches
   the installed centralized dispatcher. It is transactional and can be rerun.
3. Verify an authenticated save, reopen, edit, farm denial, and dashboard refresh
   against the target database before enabling notification rules.

Without the migration, the dashboard shows sample storage unavailable and the
entry panel explains the required installation. Other dashboard figures still load.
The Uniformity card reads the latest sample set through the selected end date for
the latest flock. The Body Weight comparison uses the sample mean if it is at least
as recent as the manually recorded weekly body weight for that sex/placement.

## Storage and access

`breeder_weight_samples` stores male/female `numeric[]` values (exactly 50 per sex),
placement/date, canonical `farm_id`, generated means and percentages, audit IDs,
revision, and the last save request key. No synthetic daily inventory rows are
created. Database validation rejects incomplete, zero, negative, null, NaN and
infinite weights, dates before placement, future dates, and stale revisions.

Active Breeder users need an active numeric `users_farms.farm_id` assignment and
Placement/View or Breeder Dashboard/View to read. Saves additionally require
Placement/Insert, the existing Population Record posting entitlement. Active
Super Admins retain the existing bypass. Authenticated clients have no direct
insert/update/delete grant; the authenticated RPC verifies permission and derives
the farm from the locked placement joined to `public.farms`.

## Notification readiness audit

This new sample subdocument supports Post and Edit. It has no Void/Delete action.
Existing Population Record Post/draft behavior is unchanged and is not declared
notification-ready by this integration.

| Check | Implementation |
| --- | --- |
| Module/events | `BREEDER_WEIGHT_SAMPLES`, `BREEDER_WEIGHT_SAMPLES_POSTED`, `BREEDER_WEIGHT_SAMPLES_EDITED` in the central catalog |
| Successful commit | `save_breeder_weight_samples` writes samples and one outbox event in the same transaction |
| Deduplication | `eventKey:sampleId:revision`; identical request retries return the saved row; unchanged weights emit nothing; stale edits fail |
| Failure | Validation, permission, conflict or outbox errors roll back the whole save; no event survives a failed save |
| No matching rule | Shared dispatcher matches active rules; no match creates no recipient deliveries and does not alter samples |
| Routing | `document`; both event farm fields copy persisted `breeder_weight_samples.farm_id`, which references `public.farms(id)` |
| Source validation | Dispatcher checks source ID, placement/farm relationship, canonical farm, event identity and revision; missing/mismatched farm marks the event invalid |
| Recipient access | Central dispatcher requires View permission and active numeric farm assignment (Super Admin bypass); no farm-code fallback for this module |
| Activation | `ruleActivationReady: false` until SQL deployment and authenticated runtime verification |

Focused local checks: `node scripts/tests/breeder-weight-samples.cjs`, TypeScript,
targeted ESLint, and `git diff --check`. These do not prove target Supabase behavior.
