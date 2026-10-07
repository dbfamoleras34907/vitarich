# Cycle Master ownership correction

Every Broiler flock card belongs to a real `doc_farm_cycles` record. Exclusion
only permits a separately entered building count; it does not remove master
ownership. Normal buildings share the master count. Each building has one active
non-void card. Each farm retains one Current Cycle; completed history is retained.

## Deployment and RLK repair

The checkout targets `glcmdjuwktlvuhbstbfj`. The connected Supabase account denied
access on 2026-10-05, so no production reads, schema deployment, or data repair
were performed. Do not deploy the UI without deploying SQL and repairing the
affected cards: the corrected UI explicitly reports missing ownership.

1. In the correct project, inspect RLK and the actual card IDs below. Building
   codes `BD-0000182` and `BD-0000183` must not be treated as numeric database IDs.
2. Check for overlapping active cards before installing the unique index. Resolve
   any duplicates by business review; this migration never deletes or closes them.
3. Deploy `app/sql/new/20261005090927_broiler_cycle_master_ownership.sql` after
   the existing Cycle Master management and cycle-mask migrations. It replaces
   the assignment trigger for all creation paths, keeps security invoker/RLS,
   adds one-active-card uniqueness, and installs owner-only repair maintenance.
4. Preview the selected RLK cards with the repair function. Regular buildings
   must share one nonblank Cycle Count. Legacy values such as `150-01` are
   preserved as the master business key and display label; the existing numeric
   column remains an internal ordering sequence. Missing or differing counts
   fail without changing data.
5. Run the same call with `true` only after reviewing the preview. It creates or
   reuses the master and links the existing cards. No flock card, placement,
   Growing, Delivery, Clean Up, inventory entry, age, quantity, cycle start date, count, or
   status is recreated or rewritten. The existing display-mask trigger refreshes
   the master mask from the earliest participating start date. The normal audit
   trigger may stamp `updated_at` when the missing link is repaired; retries do
   not update already linked cards.
6. Deploy the application and refresh Cycle Master/Growing. Confirm one RLK
   Current Cycle with two participating/open buildings, and both existing cards
   selectable in Growing. Verify the original DOC placements and ages remain.

Read-only preflight:

```sql
select id, code, name from public.farms where id = 152;
select c.id, c.card_no, c.farm_id, c.farm_cycle_id, c.cycle_no,
       c.cycle_mask, c.building_whse_id, w.whse_code, w.whse_name,
       c.start_date, c.age, c.status, c.void,
       exists(select 1 from public.doc_cycle_excluded_buildings e
         where e.farm_id=c.farm_id and e.building_whse_id=c.building_whse_id) as excluded
from public.flock_card c
left join public.i_warehouse w on w.id=c.building_whse_id
where c.farm_id=152 order by c.id;
select * from public.doc_farm_cycles where farm_id=152 order by cycle_no;
select farm_id, building_whse_id, array_agg(id order by id) as overlapping_cards
from public.flock_card where void='1' and status='Saved'
group by farm_id, building_whse_id having count(*) > 1;
```

Using the actual IDs from the preflight, as the database owner:

```sql
-- Replace the example placeholders with verified flock_card IDs, not BD codes.
-- select * from public.repair_broiler_cycle_master_links(152, array[CARD_ID_1,CARD_ID_2]::bigint[]);
-- select * from public.repair_broiler_cycle_master_links(152, array[CARD_ID_1,CARD_ID_2]::bigint[], true);
```

The repair is scoped to explicitly selected active cards and repeatable. It
rejects partial selection of a farm's other unlinked active cards, moving a card
from another master, a conflicting current master, and reusing a closed count.
Preview acquires transaction locks but changes no records. Apply rolls back in
full on failure. Existing historical unlinked records are not silently regrouped.

## Notifications and validation

This change repairs master membership, not a business Post/Edit/Void event.
DOC Placement notifications remain on the persisted goods-receipt transaction;
Growing notifications remain on the existing transaction/outbox triggers.
No recipients or inbox records are written by this change. Existing notification
readiness limits in `notification-system-design.md` still apply.

Local verification uses `scripts/database/tests/broiler-cycle-management/ownership.sql`
in a disposable PostgreSQL instance and the Cycle Dashboard/Data Compliance/mask
tests. These checks establish local behavior, not live deployment or browser QA.
