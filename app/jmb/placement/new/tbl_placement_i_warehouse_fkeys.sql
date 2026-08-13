-- Placement building_id and pen_id now come from view_farm_new_lookup,
-- whose building and pen records are both stored in public.i_warehouse.
-- NOT VALID preserves legacy placement rows that still contain IDs from the
-- retired farm_buildings/farm_pens tables, while enforcing the new references
-- for every future insert or update.

begin;

alter table public.tbl_placement
  drop constraint if exists tbl_placement_building_id_fkey;

alter table public.tbl_placement
  drop constraint if exists tbl_placement_pen_id_fkey;

alter table public.tbl_placement
  add constraint tbl_placement_building_id_fkey
  foreign key (building_id)
  references public.i_warehouse (id)
  not valid;

alter table public.tbl_placement
  add constraint tbl_placement_pen_id_fkey
  foreign key (pen_id)
  references public.i_warehouse (id)
  not valid;

commit;

-- After legacy tbl_placement IDs have been migrated to i_warehouse IDs, run:
-- alter table public.tbl_placement validate constraint tbl_placement_building_id_fkey;
-- alter table public.tbl_placement validate constraint tbl_placement_pen_id_fkey;
