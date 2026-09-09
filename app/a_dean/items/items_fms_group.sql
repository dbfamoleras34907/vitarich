alter table public.items
  add column if not exists fms_group text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'items_fms_group_check'
      and conrelid = 'public.items'::regclass
  ) then
    alter table public.items
      add constraint items_fms_group_check check (
        fms_group is null or fms_group in ('breeder', 'hatchery', 'broiler')
      );
  end if;
end;
$$;

create index if not exists items_fms_group_idx
  on public.items (fms_group);
