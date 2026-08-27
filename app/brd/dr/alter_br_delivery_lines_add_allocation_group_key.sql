begin;

alter table public.br_delivery_lines
  add column if not exists allocation_group_key text null;

update public.br_delivery_lines line
set allocation_group_key = concat(
  'legacy:',
  line.br_delivery_id,
  ':',
  upper(trim(coalesce(line.from_warehouse_code, ''))),
  ':',
  upper(trim(line.item_code))
)
where nullif(trim(line.allocation_group_key), '') is null;

alter table public.br_delivery_lines
  alter column allocation_group_key set default gen_random_uuid()::text,
  alter column allocation_group_key set not null;

create index if not exists br_delivery_lines_allocation_group_key_idx
  on public.br_delivery_lines (br_delivery_id, allocation_group_key)
  where void = '1';

commit;
