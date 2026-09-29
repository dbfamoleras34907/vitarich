# Broiler Data Compliance

Route: `/brd/data-compliance`. Navigation: Broiler → Report → Data Compliance.
View permission: `/brd/data-compliance/view` (new catalog entry 83).
The existing permission matrix can grant this report. No database migration is required.

## Views and exports

Chart View is the default: KPI cards, region compliance, TA delay buckets, farm
status and a building activity heatmap. Chart bars and accessible value lists
open matching Report View records. Building links show date gaps and saved timestamps.
Filters and Excel exports share the same calculated rows. Excel writes a real
XLSX workbook with Summary, Region Summary, Farm Summary, TA Summary and Building
Details sheets. PDF uses the existing print workflow: select Save as PDF in the
print dialog. Bar charts have PNG downloads. Both themes use shared UI tokens.

## Current rules and remaining business definitions

- The report evaluates today in Asia/Manila. Growing entries are expected through
  yesterday; today's entry is not overdue. This rule is explained below the KPI
  cards, rather than exposed as an additional filter.
- Placement requires a visible posted receipt by the cutoff. Growing coverage
  starts at age 1. At least one saved mortality, feed, water or weight measurement
  makes a daily entry; numeric zero counts, an empty placeholder does not.
  This checks record presence, not completion of every daily field.
- Every required day is checked. A newer entry never hides an earlier gap.
  Days late counts days from the oldest missing date through the cutoff inclusive.
- Partial harvest does not end Growing. Full depletion expressed in heads,
  Cleanup, or a known closed date bounds coverage. Unknown completion dates and
  obligations beyond the existing age 0–45 grid require review.
- Harvest and Cleanup dates are informational. Their deadlines are not configured
  and missing records are shown as **No deadline**, never as an invented delay.
  The KPI explicitly covers Placement and Growing until business deadlines are agreed.
- Assigned TAs are users associated with the farm through active `users_farms`
  rows whose `users.user_type = 3` (User). Admin and Super Admin are excluded.
  Associations use numeric farm IDs; legacy code-only associations are resolved
  against the available farm catalog. Contacts and encoders are not substituted.
  Multiple TAs appear individually in TA summaries, with each building counted
  once in overall KPIs. Selecting a TA scopes TA counts and exports to that user.
- Region comes only from the Farm master (`farms.region`). A blank
  farm Region is shown as **Region not set**. User regions are neither read nor
  matched, and they do not produce warnings.
- Region filters Farm options, and Region/Farm filter Assigned TA options.
  Options include available master farms even when they have no cycle records.
  The five filters are Region, Farm, Assigned TA, Cycle and Status. Farm and Cycle
  support multiple selections. Changing Region clears Farm, TA and Cycle;
  changing Farm clears TA and Cycle. **Clear** resets these five filters.
  All current, past open and closed cycles are available in the Cycle selector.
- Counts are building-cycle records, not distinct physical buildings across
  multiple cycles. Compliance = updated / (updated + overdue). Review and not-due
  records are displayed separately and excluded. Empty denominators show a dash.
- As-of evaluates currently saved activity records. It is not a historical audit
  snapshot. Later backfills and edits affect prior-date reports. Saved timestamps
  refer to receipt/Growing rows and Harvest/Cleanup headers, not immutable first
  encoding history. Historical TA attribution also remains undefined.

## Data and authorization

The shared repository reuses active assigned Broiler farms, Farm profiles, Cycle
Master catalogs and Cycle Report lineage. `farms.id` remains the key; Region is
read from `farms.region`. Current cycles exclude
Past Open; selecting all cycles includes Past Open and Closed plus standalone cycles.
The signed-in Supabase client preserves existing RLS. Three farms load concurrently;
any query failure blocks the complete report rather than publishing partial KPIs.
All totals describe visible records, not an unrestricted organization-wide audit.

This is read-only. No Post, Edit or Void operations were added or changed, so no
notification events are emitted. No database writes, migrations or policy changes.

## Verification

`node scripts/tests/data-compliance.cjs` checks calculations and shared loaders with
fixtures. `node scripts/tests/cycle-dashboard.cjs` checks report compatibility.
The compliance tests also write and read an XLSX workbook in memory to verify
sheet names, filtered records and literal text cells, and reject capped query results.
TypeScript and focused ESLint cover the implementation. Live database access,
browser rendering and downloaded PDF/PNG appearance are not verified by these checks.
