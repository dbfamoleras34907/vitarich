Run only on a new disposable PostgreSQL database. The fixture creates simplified
dependencies and uses the actual checked-in feed-intake and transaction functions.
Its mortality trigger is a probe for rollback of trigger side effects, not a test
of the production mortality calculations or production RLS policies.

Run with `psql -v ON_ERROR_STOP=1`, in this order:

1. `fixture.sql`
2. `app/brd/fc/new/save_brd_fc_transaction.sql` (from the repository root)
3. `assertions.sql`

Coverage: item mismatch rollback (even within the same subgroup) (including the header and mortality probe),
warehouse item selection without Feed Group, wrong warehouse rejection, feed inventory persistence,
native `jsonb[]` farm warehouse associations (regression for SQLSTATE 42846),
request retry deduplication, changed-payload rejection, and rollback of an edit
when a later age fails. Assertions also check notification outbox counts.
