-- Allow signed-in application users to check whether a Placement record is
-- already referenced by Growing or Egg Laying. These checks protect placement
-- dates and prevent deletion of records with dependent transactions.

grant select (id, placement_id, isactive)
on table public.tbl_growing
to authenticated;

grant select (id, placement_id, is_active)
on table public.tbl_egglaying
to authenticated;

drop policy if exists growing_select_authenticated
on public.tbl_growing;

create policy growing_select_authenticated
on public.tbl_growing
for select
to authenticated
using (true);

drop policy if exists egglaying_select_authenticated
on public.tbl_egglaying;

create policy egglaying_select_authenticated
on public.tbl_egglaying
for select
to authenticated
using (true);
