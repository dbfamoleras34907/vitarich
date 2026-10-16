alter table public.goods_issue_items
  add column if not exists allocation_group_key text null;

update public.goods_issue_items
set allocation_group_key = concat('line:', id)
where nullif(trim(allocation_group_key), '') is null;

alter table public.goods_issue_items
  alter column allocation_group_key set default gen_random_uuid()::text,
  alter column allocation_group_key set not null;

create index if not exists goods_issue_items_allocation_group_key_idx
  on public.goods_issue_items (goods_issue_id, allocation_group_key)
  where void = '1';
