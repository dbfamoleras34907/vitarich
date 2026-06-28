alter table public.items
  add column if not exists is_delivery_item boolean not null default true,
  add column if not exists min_on_hand numeric(19, 6) null,
  add column if not exists max_on_hand numeric(19, 6) null,
  add column if not exists default_expiration_months integer null;

alter table public.items
  alter column is_inventory_item set default true,
  alter column is_sales_item set default true,
  alter column is_purchase_item set default true,
  alter column is_delivery_item set default true,
  alter column manage_batch_numbers set default false,
  alter column manage_serial_numbers set default false,
  alter column batch_management_method set default 'NONE',
  alter column default_expiry_required set default false,
  alter column allow_negative_batch_stock set default false;

update public.items
set
  is_inventory_item = coalesce(is_inventory_item, true),
  is_sales_item = coalesce(is_sales_item, true),
  is_purchase_item = coalesce(is_purchase_item, true),
  is_delivery_item = coalesce(is_delivery_item, true),
  manage_batch_numbers = coalesce(manage_batch_numbers, false),
  manage_serial_numbers = coalesce(manage_serial_numbers, false),
  batch_management_method = coalesce(batch_management_method, 'NONE'),
  default_expiry_required = coalesce(default_expiry_required, false),
  allow_negative_batch_stock = coalesce(allow_negative_batch_stock, false);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'items_on_hand_check'
      and conrelid = 'public.items'::regclass
  ) then
    alter table public.items
      add constraint items_on_hand_check check (
        on_hand >= 0
        and is_committed >= 0
        and on_order >= 0
        and (min_on_hand is null or min_on_hand >= 0)
        and (max_on_hand is null or max_on_hand >= 0)
        and (default_expiration_months is null or default_expiration_months >= 0)
        and (min_on_hand is null or max_on_hand is null or max_on_hand >= min_on_hand)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'items_default_expiration_months_check'
      and conrelid = 'public.items'::regclass
  ) then
    alter table public.items
      add constraint items_default_expiration_months_check check (
        default_expiration_months is null or default_expiration_months >= 0
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'items_batch_management_method_check'
      and conrelid = 'public.items'::regclass
  ) then
    alter table public.items
      add constraint items_batch_management_method_check check (
        batch_management_method in ('NONE', 'MANUAL', 'AUTO')
      );
  end if;
end;
$$;

create index if not exists items_void_idx
  on public.items (void);

create index if not exists items_item_group_idx
  on public.items (item_group);

create index if not exists items_inventory_uom_idx
  on public.items (inventory_uom);

create index if not exists items_manage_batch_numbers_idx
  on public.items (manage_batch_numbers);
