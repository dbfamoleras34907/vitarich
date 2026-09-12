# Broiler Cycle Dashboard

Route: `/brd/dashboard`; existing navigation identity `60`, label **Cycle Dashboard**.
View permission: `/brd/dashboard/view`. Farm choices come from active assigned
Broiler farms through `listAssignedUserFarmOptions`, using numeric `farm_id`
assignments and its existing documented legacy farm-code fallback. The loader
rechecks assignment before requesting farm records and uses the normal RLS client.

## Selection and data

- Default to the user's working default farm, resolved only within assigned farms.
- Keep the breadcrumb and compact Refresh toolbar separate from navigation.
  The toolbar's **Compact view** switch reduces card padding, section spacing,
  details-column width, chart height, and transaction-row padding. It adds a fourth
  metric column on wide screens without hiding values. Standard view is the default;
  the switch preserves current selections and applies while the page remains open.
  Farm and Cycle share a context panel, side-by-side from tablet widths and stacked
  on mobile. Primary navigation uses **Farm View / Records** segmented tabs.
- Group the green segmented Building selector and selected building/cycle/status
  in one compact navigation card. Process tabs use soft green filled selected states.
  Building and process controls scroll horizontally on narrow screens, retain keyboard
  navigation, and preserve farm/cycle/building context when changing processes.
- Default to the latest active farm cycle, falling back to the highest cycle number.
  The Cycle selector recalls closed and cancelled cycles without reopening them.
- Records opens the existing Cycle Master report for both farm and standalone building
  cycles, retaining the Cycle Report View permission.
- Publish the Cycle Master list before loading buildings and transaction details.
  Keep that list and its selected cycle visible if a detail query fails; show the
  precise detail error separately. Additional warehouse/standalone-cycle lookup
  failures produce explicit warnings without hiding valid farm cycles or their
  persisted participating buildings.
- Building tabs follow building-code order. Initially select the first open building
  in the selected cycle, then the first participating building if all are closed.
  All Buildings totals and charts include only that selected cycle.
- Empty buildings show **No records in this cycle**. Closed buildings retain their
  true status; void/cancelled placement records do not contribute to metrics.
- Excluded-building cycles retain their exact text label and can also be recalled,
  even with a null `farm_cycle_id`. Farm cycles take priority for default selection;
  when none exist, the newest standalone building cycle is selected.
- DOC Placement, Delivery and Clean-up require `Posted`, non-void records.
- Growing has no separate document Post operation. `save_brd_fc_transaction`
  commits daily measurements and inventory together, even when its header remains
  `Draft`. Include its committed non-void daily rows, excluding cancelled headers.
  Guideline-only rows do not count as recorded measurements or advance posted age.
- Cycle Report matches movements by warehouse and original/consolidated cycle batch.
  Reuse that implementation, with opt-in filters; historical Cycle Master behavior
  remains available through the default options.
- Growing and movement reads paginate their results, and movement line reads use
  bounded document-ID batches so older farm history cannot silently hide current data.
- No writes, autosaves, date filters, cost metrics, or medication metrics.

## Calculations

- Starting population totals Actual Received from posted, non-void DOC receipts
  whose received date matches the building cycle's start date. Each receipt detail
  is counted once even when linked to multiple inventory items. Later receipts are
  excluded; no matching receipts show Not recorded. All Buildings sums each
  building's starting population using its own cycle start date.
- Placement totals Actual Received (good birds) once per posted, non-void receipt
  detail. Placement tables show only the good-bird item, identified by historical
  flock origin batches or the farm DOC receiving settings, with DOA/reject/short
  counts retained as columns.
- Mortality, depletion, and remaining birds share `getBroilerDepletionSummary`
  with Flock Card Report. Dashboard remaining birds subtract mortality, thinning,
  posted harvest heads, and posted clean-up heads from the Growing population.
  The Population card shows the formula and its component values.
- Calendar age is elapsed days from placement in the Philippines. Calendar and
  posted age displays and chart axes stop at 45 days. Posted Growing age is the latest age with
  a recorded daily metric. Weight identifies its own latest measurement age.
  Recalled closed cycles stop calendar age at the building's last posted cleanup
  date, falling back to the farm-cycle closure date; absent both, age is unavailable.
- Feed and water charts reuse the Growing sheet's per-bird calculations and
  breed standards. Feed units are g/bird/day; water units are mL/bird/day.
- Feed Conversion is hidden. The calculation helper remains available.
- Body Weight uses the latest positive measurement, falling back to recorded zero
  only when no positive measurement exists. Water uses recorded flock liters;
  legacy per-bird-only entries are converted using the row's population and cumulative depletion.
- Delivery weight uses recorded kg (or gram) quantities, never a head count or
  an inferred weight. Unknown units/missing weight show **Not recorded**.
- All Buildings ratios use underlying totals, and body weight uses Growing-population
  weights so fully harvested buildings retain their measured weight. Missing inputs make totals unavailable rather than silently treating
  unrecorded data as zero. Duplicate delivery line IDs are counted once.
- Charts align by age. Feed, water, and weight use available bird-weighted
  measurements; mortality totals require all selected flocks at that age.

## Notification readiness

This dashboard is read-only and supports no Post, Edit, or Void action. No event
keys, outbox writes, recipients, or farm-routing rules are introduced. Links open
the existing source pages under their existing View permissions. Business mutation
paths and their notification contracts are unchanged.

## Verification

`node scripts/tests/cycle-dashboard.cjs` runs the real repository and calculation
code against in-memory fixtures. It covers posting/void filters, warehouse and cycle
lineage, assignment rejection, latest/closed cycle recall, default building selection,
missing versus zero, weighted totals, age, FCR guards, and report compatibility.
Also run focused ESLint, `npx.cmd tsc --noEmit --pretty false`, and `git diff --check`.
These checks do not verify deployed SQL or authenticated RLS behavior.
