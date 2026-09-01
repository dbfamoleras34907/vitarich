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
  v_parent_void text;
  v_depth integer;
begin
  if new.father is null then
    return new;
  end if;

  select parent.void::text
  into v_parent_void
  from public.item_groups parent
  where parent.id = new.father
  for update;

  if not found then
    raise exception 'Sub item group father % does not exist.', new.father;
  end if;

  if btrim(coalesce(v_parent_void, '0')) <> '1' then
    raise exception 'A sub item group must belong to an active item group.';
  end if;

  if new.id is not null and exists (
    with recursive ancestors as (
      select parent.id, parent.father, array[parent.id]::bigint[] as path
      from public.item_groups parent
      where parent.id = new.father

      union all

      select parent.id, parent.father, ancestors.path || parent.id
      from public.item_groups parent
      join ancestors on parent.id = ancestors.father
      where not parent.id = any(ancestors.path)
    )
    select 1 from ancestors where id = new.id
  ) then
    raise exception 'An item group cannot be moved beneath itself or one of its descendants.';
  end if;

  with recursive ancestors as (
    select parent.id, parent.father, 1 as depth, array[parent.id]::bigint[] as path
    from public.item_groups parent
    where parent.id = new.father

    union all

    select parent.id, parent.father, ancestors.depth + 1, ancestors.path || parent.id
    from public.item_groups parent
    join ancestors on parent.id = ancestors.father
    where ancestors.depth < 6
      and not parent.id = any(ancestors.path)
  )
  select max(depth) + 1 into v_depth from ancestors;

  if coalesce(v_depth, 1) > 6 then
    raise exception 'Item groups are limited to 5 sub item group levels below the root Item Group.';
  end if;

  if exists (
    select 1
    from public.items item
    where item.sub_item_group_id = new.father
      and btrim(coalesce(item.void::text, '0')) = '1'
  ) then
    raise exception 'Move or void the active items assigned to the parent group before adding a child.';
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

create or replace function public.block_item_group_void_with_dependencies()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if btrim(coalesce(old.void::text, '0')) <> '1'
     or btrim(coalesce(new.void::text, '0')) = '1' then
    return new;
  end if;

  if exists (
    select 1 from public.item_groups child
    where child.father = new.id
      and btrim(coalesce(child.void::text, '0')) = '1'
  ) then
    raise exception 'Void or move the active child groups first.';
  end if;

  if exists (
    select 1 from public.items item
    where item.sub_item_group_id = new.id
      and btrim(coalesce(item.void::text, '0')) = '1'
  ) then
    raise exception 'Move or void the active items assigned to this group first.';
  end if;

  return new;
end;
$$;

drop trigger if exists item_groups_block_void_with_dependencies on public.item_groups;
create trigger item_groups_block_void_with_dependencies
before update of void
on public.item_groups
for each row
execute function public.block_item_group_void_with_dependencies();

notify pgrst, 'reload schema';
