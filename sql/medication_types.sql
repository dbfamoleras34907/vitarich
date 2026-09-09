-- Run in Supabase SQL Editor after public.tbl_brd_medication exists.
begin;
create table if not exists public.tbl_brd_medication_type (
  name text primary key check (name = btrim(name) and length(name) between 1 and 100),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Add approved Medication Type names here after the list is confirmed.
-- Manage this master list through Supabase; application users have read access only.
alter table public.tbl_brd_medication_type enable row level security;
revoke all on public.tbl_brd_medication_type from anon, authenticated;
grant select on public.tbl_brd_medication_type to authenticated;
drop policy if exists medication_type_read on public.tbl_brd_medication_type;
create policy medication_type_read on public.tbl_brd_medication_type
  for select to authenticated using (true);

-- Validate inserts and changed type values without rewriting historical records.
create or replace function public.validate_brd_medication_type()
returns trigger language plpgsql security invoker set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' then
    if NEW.medication_type is not distinct from OLD.medication_type then
      return NEW;
    end if;
  end if;
  if not exists (
    select 1 from public.tbl_brd_medication_type
    where name = NEW.medication_type and is_active
  ) then
    raise exception 'Select an active medication type from the list.' using errcode = '23514';
  end if;
  return NEW;
end;
$$;
drop trigger if exists validate_brd_medication_type on public.tbl_brd_medication;
create trigger validate_brd_medication_type
before insert or update of medication_type on public.tbl_brd_medication
for each row execute function public.validate_brd_medication_type();
commit;
