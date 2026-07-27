begin;

create table if not exists public.br_cleanup (
  id bigint generated always as identity primary key,
  created_by uuid null references auth.users (id),
  created_at timestamp with time zone not null default now(),
  updated_by uuid null references auth.users (id),
  updated_at timestamp with time zone null,
  gi_no text not null unique,
  issue_date date not null,
  farm_id bigint null references public.farms (id),
  farm_code text null,
  farm_name text null,
  from_warehouse_id bigint null references public.i_warehouse (id),
  from_warehouse_code text null,
  from_warehouse_name text null,
  triggered_by text not null default 'BR-CU',
  status text not null default 'Draft',
  remarks text null,
  constraint br_cleanup_status_check check (status in ('Draft', 'Posted', 'Cancelled'))
);

create table if not exists public.br_cleanup_lines (
  id bigint generated always as identity primary key,
  created_by uuid null references auth.users (id),
  created_at timestamp with time zone not null default now(),
  updated_by uuid null references auth.users (id),
  updated_at timestamp with time zone null,
  br_cleanup_id bigint not null references public.br_cleanup (id) on delete cascade,
  line_no integer not null,
  item_id bigint null references public.items (id),
  item_code text not null,
  description text null,
  batch_rule_id bigint null references public.batch_rules (id),
  batch_number text null,
  manufacturing_date date null,
  expiry_date date null,
  alt_qty numeric(18, 6) not null default 0,
  alt_uom text not null,
  base_qty numeric(18, 6) not null default 0,
  base_uom text not null,
  from_warehouse_id bigint null references public.i_warehouse (id),
  from_warehouse_code text null,
  from_warehouse_name text null,
  void text not null default '1',
  constraint br_cleanup_lines_cleanup_line_key unique (br_cleanup_id, line_no),
  constraint br_cleanup_lines_qty_check check (alt_qty >= 0 and base_qty >= 0)
);

create index if not exists br_cleanup_issue_date_idx on public.br_cleanup (issue_date desc);
create index if not exists br_cleanup_farm_id_idx on public.br_cleanup (farm_id);
create index if not exists br_cleanup_status_idx on public.br_cleanup (status);
create index if not exists br_cleanup_lines_cleanup_id_idx on public.br_cleanup_lines (br_cleanup_id);
create index if not exists br_cleanup_lines_item_id_idx on public.br_cleanup_lines (item_id);
create index if not exists br_cleanup_lines_batch_number_idx on public.br_cleanup_lines (batch_number);
create index if not exists br_cleanup_lines_warehouse_id_idx on public.br_cleanup_lines (from_warehouse_id);
create index if not exists br_cleanup_lines_void_idx on public.br_cleanup_lines (void);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.post_br_cleanup_inventory()
returns trigger
language plpgsql
as $$
begin
  if new.status <> 'Posted' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'Posted' then
    return new;
  end if;

  if exists (
    with issue_qty as (
      select
        line.item_code,
        line.from_warehouse_code as warehouse_code,
        line.batch_number,
        sum(line.base_qty) as required_qty
      from public.br_cleanup_lines line
      where line.br_cleanup_id = new.id
        and line.void = '1'
        and line.item_code is not null
        and line.from_warehouse_code is not null
        and line.base_qty > 0
      group by line.item_code, line.from_warehouse_code, line.batch_number
    ),
    on_hand as (
      select
        posting.item_code,
        posting.warehouse_code,
        posting.ref as batch_number,
        sum(case when posting.transfer_type = 'OUT' then -posting.qty else posting.qty end) as qty
      from public.inventory_postings posting
      group by posting.item_code, posting.warehouse_code, posting.ref
    )
    select 1
    from issue_qty required
    left join on_hand available
      on available.item_code = required.item_code
     and available.warehouse_code = required.warehouse_code
     and available.batch_number is not distinct from required.batch_number
    where required.required_qty > coalesce(available.qty, 0)
  ) then
    raise exception 'Broiler clean-up quantity exceeds on-hand inventory.';
  end if;

  insert into public.inventory_postings (
    source_doc_type, source_docentry, item_code, warehouse_code, bin_code,
    qty, created_by, ref_type, ref, transfer_type, ref_type2, ref2
  )
  select
    'BR_CLEANUP',
    new.id,
    line.item_code,
    line.from_warehouse_code,
    'MAIN SUB BIN',
    sum(line.base_qty),
    coalesce(new.updated_by, new.created_by),
    'batch_code',
    line.batch_number,
    'OUT',
    null,
    null
  from public.br_cleanup_lines line
  where line.br_cleanup_id = new.id
    and line.void = '1'
    and line.item_code is not null
    and line.from_warehouse_code is not null
    and line.base_qty > 0
  group by line.item_code, line.from_warehouse_code, line.batch_number;

  return new;
end;
$$;

drop trigger if exists post_br_cleanup_inventory_trigger on public.br_cleanup;
create trigger post_br_cleanup_inventory_trigger
after update of status on public.br_cleanup
for each row
when (new.status = 'Posted' and old.status is distinct from 'Posted')
execute function public.post_br_cleanup_inventory();

drop trigger if exists set_br_cleanup_updated_at on public.br_cleanup;
create trigger set_br_cleanup_updated_at
before update on public.br_cleanup
for each row execute function public.set_updated_at();

drop trigger if exists set_br_cleanup_lines_updated_at on public.br_cleanup_lines;
create trigger set_br_cleanup_lines_updated_at
before update on public.br_cleanup_lines
for each row execute function public.set_updated_at();

commit;
