begin;

create table if not exists public.br_cleanup_types (
  id bigint generated always as identity primary key,
  code text generated always as ('CT-' || lpad(id::text, 3, '0')) stored unique,
  name text not null,
  is_void boolean not null default false,
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  updated_at timestamptz null,
  voided_by uuid null references auth.users(id),
  voided_at timestamptz null,
  constraint br_cleanup_types_name_check
    check (char_length(btrim(name)) between 1 and 80)
);

comment on table public.br_cleanup_types is
  'Global Broiler cleanup type master data. Voided rows are retained for recovery and audit.';
comment on column public.br_cleanup_types.code is
  'System-generated cleanup type code in CT-001 format.';

create unique index if not exists br_cleanup_types_name_unique
  on public.br_cleanup_types (lower(btrim(name)));

alter table public.br_cleanup_types enable row level security;

revoke all on table public.br_cleanup_types from anon, authenticated;
grant select on table public.br_cleanup_types to authenticated;

drop policy if exists "Authenticated users can view active cleanup types"
  on public.br_cleanup_types;
create policy "Authenticated users can view active cleanup types"
  on public.br_cleanup_types
  for select
  to authenticated
  using (not is_void);

commit;
