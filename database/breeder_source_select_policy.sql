-- Allow signed-in application users to load the Source of Birds dropdown.
-- RLS remains enabled and anonymous users receive no access.

grant select on table public.tbl_breeder_source to authenticated;

drop policy if exists breeder_source_select_authenticated
on public.tbl_breeder_source;

create policy breeder_source_select_authenticated
on public.tbl_breeder_source
for select
to authenticated
using (true);
