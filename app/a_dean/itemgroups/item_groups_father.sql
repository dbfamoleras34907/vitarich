alter table public.item_groups
  add column if not exists father bigint null;

alter table public.item_groups
  drop constraint if exists item_groups_father_fkey;

alter table public.item_groups
  add constraint item_groups_father_fkey
  foreign key (father)
  references public.item_groups (id);

alter table public.item_groups
  drop constraint if exists item_groups_father_not_self_chk;

alter table public.item_groups
  add constraint item_groups_father_not_self_chk
  check (father is null or father <> id);

create index if not exists item_groups_father_idx
  on public.item_groups (father);

create or replace function public.validate_item_group_father()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parent_father bigint;
  v_parent_void text;
begin
  if new.father is null then
    return new;
  end if;

  select parent.father, parent.void::text
  into v_parent_father, v_parent_void
  from public.item_groups parent
  where parent.id = new.father;

  if not found then
    raise exception 'Sub item group father % does not exist.', new.father;
  end if;

  if btrim(coalesce(v_parent_void, '0')) <> '1' then
    raise exception 'A sub item group must belong to an active item group.';
  end if;

  if v_parent_father is not null then
    raise exception 'Sub item groups cannot have their own sub item groups.';
  end if;

  if new.id is not null and exists (
    select 1
    from public.item_groups child
    where child.father = new.id
  ) then
    raise exception 'An item group with sub item groups cannot become a sub item group.';
  end if;

  return new;
end;
$$;

drop trigger if exists item_groups_validate_father on public.item_groups;
create trigger item_groups_validate_father
before insert or update of father
on public.item_groups
for each row
execute function public.validate_item_group_father();

notify pgrst, 'reload schema';
