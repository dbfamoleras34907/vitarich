alter table public.i_warehouse
  add column if not exists farm_id bigint null,
  add column if not exists farm_code text null,
  add column if not exists farm_name text null;

alter table public.i_warehouse
  drop constraint if exists i_warehouse_farm_id_fkey;

alter table public.i_warehouse
  add constraint i_warehouse_farm_id_fkey
  foreign key (farm_id)
  references public.farms (id);

create index if not exists i_warehouse_farm_id_idx
  on public.i_warehouse (farm_id);

