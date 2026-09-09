-- Item Group catalogs: one root with three independent optional subgroup lists.
-- `father` and any previously deployed relationship rows are retained only as
-- legacy migration data. Runtime classification uses root_item_group_id and subgroup_level.

alter table public.item_groups
  add column if not exists father bigint null,
  add column if not exists root_item_group_id bigint null,
  add column if not exists subgroup_level smallint null;

alter table public.item_groups
  drop constraint if exists item_groups_father_fkey,
  drop constraint if exists item_groups_root_item_group_id_fkey,
  drop constraint if exists item_groups_subgroup_level_chk;

alter table public.item_groups
  add constraint item_groups_father_fkey foreign key (father) references public.item_groups (id),
  add constraint item_groups_root_item_group_id_fkey foreign key (root_item_group_id) references public.item_groups (id),
  add constraint item_groups_subgroup_level_chk check (subgroup_level is null or subgroup_level between 1 and 3);

create index if not exists item_groups_father_idx on public.item_groups (father);
create index if not exists item_groups_root_level_idx
  on public.item_groups (root_item_group_id, subgroup_level);

do $$
declare
  v_too_deep bigint;
begin
  with recursive hierarchy as (
    select root.id, 0 as depth, array[root.id]::bigint[] as path
    from public.item_groups root
    where root.father is null
    union all
    select child.id, hierarchy.depth + 1, hierarchy.path || child.id
    from public.item_groups child
    join hierarchy on child.father = hierarchy.id
    where not child.id = any(hierarchy.path)
  )
  select id into v_too_deep from hierarchy where depth > 3 limit 1;

  if v_too_deep is not null then
    raise exception 'Existing Item Group % is deeper than the new three-level subgroup limit.', v_too_deep;
  end if;
end;
$$;

with recursive hierarchy as (
  select root.id, root.id as root_id, 0 as depth, array[root.id]::bigint[] as path
  from public.item_groups root
  where root.father is null
  union all
  select child.id, hierarchy.root_id, hierarchy.depth + 1, hierarchy.path || child.id
  from public.item_groups child
  join hierarchy on child.father = hierarchy.id
  where hierarchy.depth < 3 and not child.id = any(hierarchy.path)
)
update public.item_groups target
set root_item_group_id = case
      when hierarchy.depth = 0 then null
      else coalesce(target.root_item_group_id, hierarchy.root_id)
    end,
    subgroup_level = case
      when hierarchy.depth = 0 then null
      else coalesce(target.subgroup_level, hierarchy.depth)
    end
from hierarchy
where target.id = hierarchy.id
  and (
    hierarchy.depth = 0
    or target.root_item_group_id is null
    or target.subgroup_level is null
  );

do $$
begin
  if exists (
    select 1 from public.item_groups
    where father is not null
      and (root_item_group_id is null or subgroup_level is null)
  ) then
    raise exception 'The existing Item Group hierarchy contains an orphan or incomplete parent chain.';
  end if;
end;
$$;

drop trigger if exists item_groups_validate_father on public.item_groups;
drop function if exists public.validate_item_group_father();
drop function if exists public.save_item_group_child(bigint, text, text);

create or replace function public.save_item_group_catalog_entry(
  p_root_item_group_id bigint,
  p_subgroup_level smallint,
  p_name text,
  p_remarks text default null
)
returns table (
  id bigint, code text, name text, remarks text, void text, father bigint,
  root_item_group_id bigint, subgroup_level smallint,
  created_at timestamptz, updated_at timestamptz, was_created boolean
)
language plpgsql
set search_path = public
as $$
declare
  v_root public.item_groups%rowtype;
  v_group public.item_groups%rowtype;
  v_created boolean := false;
begin
  if p_subgroup_level not between 1 and 3 then
    raise exception 'Sub Group Level must be 1, 2, or 3.';
  end if;
  if nullif(btrim(p_name), '') is null then raise exception 'Name is required.'; end if;

  select * into v_root
  from public.item_groups root_group
  where root_group.id = p_root_item_group_id
    and root_group.father is null
    and btrim(coalesce(root_group.void::text, '0')) = '1'
  for update;
  if not found then raise exception 'The root Item Group must be active.'; end if;

  perform pg_advisory_xact_lock(hashtext(
    'item-group-catalog:' || p_root_item_group_id::text || ':' ||
    p_subgroup_level::text || ':' || lower(btrim(p_name))
  )::bigint);

  select * into v_group
  from public.item_groups candidate
  where candidate.root_item_group_id = p_root_item_group_id
    and candidate.subgroup_level = p_subgroup_level
    and lower(btrim(candidate.name)) = lower(btrim(p_name))
    and btrim(coalesce(candidate.void::text, '0')) = '1'
  order by candidate.id
  limit 1
  for update;

  if not found then
    insert into public.item_groups (
      code, name, remarks, father, root_item_group_id, subgroup_level, void
    ) values (
      'PENDING-' || gen_random_uuid()::text, btrim(p_name), nullif(btrim(p_remarks), ''),
      p_root_item_group_id, p_root_item_group_id, p_subgroup_level, '1'
    ) returning * into v_group;
    update public.item_groups set code = v_group.id::text
    where item_groups.id = v_group.id returning * into v_group;
    v_created := true;
  end if;

  return query select
    v_group.id, v_group.code::text, v_group.name::text, v_group.remarks::text,
    v_group.void::text, v_group.father, v_group.root_item_group_id,
    v_group.subgroup_level, v_group.created_at, v_group.updated_at, v_created;
end;
$$;

revoke all on function public.save_item_group_catalog_entry(bigint, smallint, text, text)
from public, anon, authenticated;
grant execute on function public.save_item_group_catalog_entry(bigint, smallint, text, text)
to service_role;

alter table public.items
  add column if not exists sub_item_group_level_1_id bigint null,
  add column if not exists sub_item_group_level_2_id bigint null,
  add column if not exists sub_item_group_level_3_id bigint null;

create or replace function public.block_item_group_void_with_dependencies()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if btrim(coalesce(old.void::text, '0')) <> '1'
     or btrim(coalesce(new.void::text, '0')) = '1' then return new; end if;

  if exists (
    select 1 from public.items item
    where new.id = any(array[
      item.sub_item_group_level_1_id,
      item.sub_item_group_level_2_id,
      item.sub_item_group_level_3_id
    ]) and btrim(coalesce(item.void::text, '0')) = '1'
  ) then raise exception 'Move or void the active items assigned through this group first.'; end if;
  return new;
end;
$$;

drop trigger if exists item_groups_block_void_with_dependencies on public.item_groups;
create trigger item_groups_block_void_with_dependencies
before update of void on public.item_groups
for each row execute function public.block_item_group_void_with_dependencies();

notify pgrst, 'reload schema';
