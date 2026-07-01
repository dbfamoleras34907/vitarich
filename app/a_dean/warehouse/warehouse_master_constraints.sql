-- Alter script for current public.i_warehouse schema.
--
-- Only missing column to add:
--   fms_type = Broiler, Breeder, Hatchery
--
-- Existing column kept as-is:
--   warehouse_type = Warehouse, Building
--
-- No column is renamed.
--
-- Code format:
--   Warehouse -> WH-0000001
--   Building  -> BD-0000001

-- 1. Add only the missing column.
alter table public.i_warehouse
  add column if not exists fms_type text;

-- Optional one-time backfill if old rows stored Broiler/Breeder/Hatchery in warehouse_type.
-- Leave commented if you only want to add the missing column and handle old data manually.
-- update public.i_warehouse
-- set fms_type = btrim(warehouse_type)
-- where nullif(btrim(coalesce(fms_type, '')), '') is null
--   and btrim(coalesce(warehouse_type, '')) in ('Broiler', 'Breeder', 'Hatchery');

-- 2. Replace the existing warehouse code trigger function.
-- First attempt uses count of existing records of that warehouse type + 1.
-- If that code already exists, it falls back to max existing suffix + 1.
-- It tries up to 3 candidates before raising an exception.
create or replace function public.dmf_set_warehouse_code_sequence()
returns trigger
language plpgsql
as $$
declare
  normalized_fms_type text;
  normalized_warehouse_type text;
  code_prefix text;
  candidate_no bigint;
  candidate_code text;
  max_existing_no bigint;
  attempt integer;
begin
  normalized_fms_type := initcap(lower(btrim(coalesce(new.fms_type, 'Broiler'))));
  normalized_warehouse_type := initcap(lower(btrim(coalesce(new.warehouse_type, 'Warehouse'))));

  if normalized_fms_type not in ('Broiler', 'Breeder', 'Hatchery') then
    raise exception 'Invalid FMS type: %. Allowed values are Broiler, Breeder, Hatchery.', new.fms_type;
  end if;

  case normalized_warehouse_type
    when 'Warehouse' then code_prefix := 'WH';
    when 'Building' then code_prefix := 'BD';
    else
      raise exception 'Invalid warehouse type: %. Allowed values are Warehouse, Building.', new.warehouse_type;
  end case;

  new.fms_type := normalized_fms_type;
  new.warehouse_type := normalized_warehouse_type;

  perform pg_advisory_xact_lock(hashtext('public.i_warehouse:' || code_prefix)::bigint);

  for attempt in 1..3 loop
    if attempt = 1 then
      select count(*) + 1
      into candidate_no
      from public.i_warehouse
      where btrim(coalesce(warehouse_type, '')) = normalized_warehouse_type;
    else
      select coalesce(max((substring(whse_code from ('^' || code_prefix || '-([0-9]{7})$')))::bigint), 0)
      into max_existing_no
      from public.i_warehouse
      where whse_code like code_prefix || '-%';

      candidate_no := max_existing_no + (attempt - 1);
    end if;

    candidate_code := code_prefix || '-' || lpad(candidate_no::text, 7, '0');

    if not exists (
      select 1
      from public.i_warehouse
      where upper(btrim(whse_code)) = upper(candidate_code)
    ) then
      new.whse_code := candidate_code;
      return new;
    end if;
  end loop;

  raise exception 'Unable to generate warehouse code for type % after 3 attempts.', normalized_warehouse_type;
end;
$$;

drop trigger if exists dmf_tr_dmf_set_warehouse_code_sequence
  on public.i_warehouse;

create trigger dmf_tr_dmf_set_warehouse_code_sequence
before insert
on public.i_warehouse
for each row
execute function public.dmf_set_warehouse_code_sequence();

-- 3. Enforce allowed FMS Type values.
alter table public.i_warehouse
  drop constraint if exists i_warehouse_fms_type_allowed_chk;

alter table public.i_warehouse
  add constraint i_warehouse_fms_type_allowed_chk
  check (
    nullif(btrim(fms_type), '') is not null
    and btrim(fms_type) in ('Broiler', 'Breeder', 'Hatchery')
  )
  not valid;

-- 4. Enforce allowed Warehouse Type values.
alter table public.i_warehouse
  drop constraint if exists i_warehouse_type_allowed_chk;

alter table public.i_warehouse
  add constraint i_warehouse_type_allowed_chk
  check (
    nullif(btrim(warehouse_type), '') is not null
    and btrim(warehouse_type) in ('Warehouse', 'Building')
  )
  not valid;

-- 5. Require warehouse code after the BEFORE INSERT sequence trigger runs.
alter table public.i_warehouse
  drop constraint if exists i_warehouse_whse_code_required_chk;

alter table public.i_warehouse
  add constraint i_warehouse_whse_code_required_chk
  check (nullif(btrim(whse_code), '') is not null)
  not valid;

-- 6. Require warehouse name.
alter table public.i_warehouse
  drop constraint if exists i_warehouse_whse_name_required_chk;

alter table public.i_warehouse
  add constraint i_warehouse_whse_name_required_chk
  check (nullif(btrim(whse_name), '') is not null)
  not valid;

-- 7. Prevent duplicate warehouse codes.
-- Resolve duplicates first before running this index if existing data has duplicates.
create unique index if not exists i_warehouse_whse_code_uidx
  on public.i_warehouse (upper(btrim(whse_code)))
  where nullif(btrim(whse_code), '') is not null;

-- Optional: run these only after existing records are cleaned.
-- alter table public.i_warehouse validate constraint i_warehouse_fms_type_allowed_chk;
-- alter table public.i_warehouse validate constraint i_warehouse_type_allowed_chk;
-- alter table public.i_warehouse validate constraint i_warehouse_whse_code_required_chk;
-- alter table public.i_warehouse validate constraint i_warehouse_whse_name_required_chk;
