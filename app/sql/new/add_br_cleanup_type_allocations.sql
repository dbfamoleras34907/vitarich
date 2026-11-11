-- Apply create_global_br_cleanup_types.sql first.
begin;

create table if not exists public.br_cleanup_type_allocations (
  id bigint generated always as identity primary key,
  br_cleanup_id bigint not null references public.br_cleanup(id) on delete cascade,
  allocation_no integer not null,
  cleanup_type_id bigint not null references public.br_cleanup_types(id),
  cleanup_type_code text not null,
  cleanup_type_name text not null,
  quantity numeric(18, 6) not null,
  remarks text not null,
  from_warehouse_id bigint null references public.i_warehouse(id),
  from_warehouse_code text null,
  item_id bigint null references public.items(id),
  item_code text not null,
  void text not null default '1',
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  updated_at timestamptz null,
  constraint br_cleanup_type_allocations_quantity_check check (quantity >= 0),
  constraint br_cleanup_type_allocations_remarks_check check (char_length(btrim(remarks)) between 1 and 500),
  constraint br_cleanup_type_allocations_void_check check (void in ('0', '1'))
);

comment on table public.br_cleanup_type_allocations is
  'Cleanup Type quantities allocated to each visible building/item line group of a Broiler Clean Up document.';

create index if not exists br_cleanup_type_allocations_cleanup_idx
  on public.br_cleanup_type_allocations (br_cleanup_id, allocation_no);
create index if not exists br_cleanup_type_allocations_type_idx
  on public.br_cleanup_type_allocations (cleanup_type_id);
create unique index if not exists br_cleanup_type_allocations_active_type_uidx
  on public.br_cleanup_type_allocations (
    br_cleanup_id,
    coalesce(from_warehouse_id, 0),
    upper(coalesce(from_warehouse_code, '')),
    coalesce(item_id, 0),
    upper(item_code),
    cleanup_type_id
  ) where void = '1';

alter table public.br_cleanup_type_allocations enable row level security;

revoke all on table public.br_cleanup_type_allocations from anon, authenticated;
grant select, insert, update on table public.br_cleanup_type_allocations to authenticated;
grant usage, select on sequence public.br_cleanup_type_allocations_id_seq to authenticated;

drop policy if exists "Users can view accessible cleanup type allocations"
  on public.br_cleanup_type_allocations;
create policy "Users can view accessible cleanup type allocations"
  on public.br_cleanup_type_allocations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.br_cleanup document
      where document.id = br_cleanup_type_allocations.br_cleanup_id
    )
  );

drop policy if exists "Users can insert draft cleanup type allocations"
  on public.br_cleanup_type_allocations;
create policy "Users can insert draft cleanup type allocations"
  on public.br_cleanup_type_allocations
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1
      from public.br_cleanup document
      where document.id = br_cleanup_type_allocations.br_cleanup_id
        and document.status = 'Draft'
    )
  );

drop policy if exists "Users can update draft cleanup type allocations"
  on public.br_cleanup_type_allocations;
create policy "Users can update draft cleanup type allocations"
  on public.br_cleanup_type_allocations
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.br_cleanup document
      where document.id = br_cleanup_type_allocations.br_cleanup_id
        and document.status = 'Draft'
    )
  )
  with check (
    exists (
      select 1
      from public.br_cleanup document
      where document.id = br_cleanup_type_allocations.br_cleanup_id
        and document.status = 'Draft'
    )
  );

notify pgrst, 'reload schema';

commit;
