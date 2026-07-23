alter table public.i_warehouse
  add column if not exists farm_id bigint null,
  add column if not exists farm_code text null,
  add column if not exists farm_name text null,
  add column if not exists is_default_feed_warehouse boolean not null default false,
  add column if not exists is_default_receiving_warehouse boolean not null default false,
  add column if not exists is_default_disposal_warehouse boolean not null default false;

alter table public.i_warehouse
  drop constraint if exists i_warehouse_farm_id_fkey;

alter table public.i_warehouse
  add constraint i_warehouse_farm_id_fkey
  foreign key (farm_id)
  references public.farms (id);

create index if not exists i_warehouse_farm_id_idx
  on public.i_warehouse (farm_id);

create unique index if not exists i_warehouse_default_feed_per_farm_uidx
  on public.i_warehouse (farm_id)
  where farm_id is not null and is_default_feed_warehouse;

create unique index if not exists i_warehouse_default_receiving_per_farm_uidx
  on public.i_warehouse (farm_id)
  where farm_id is not null and is_default_receiving_warehouse;

create unique index if not exists i_warehouse_default_disposal_per_farm_uidx
  on public.i_warehouse (farm_id)
  where farm_id is not null and is_default_disposal_warehouse;

