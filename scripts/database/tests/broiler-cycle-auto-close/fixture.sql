\set ON_ERROR_STOP on

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role;
  end if;
end;
$$;

create schema auth;
create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('test.auth_uid', true), '')::uuid;
$$;

grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;

create table public.doc_farm_cycles (
  id bigint primary key,
  farm_id bigint not null,
  cycle_no bigint not null,
  status text not null,
  closed_at timestamptz,
  closed_by uuid,
  updated_at timestamptz,
  updated_by uuid
);

create table public.flock_card (
  id bigint primary key,
  farm_cycle_id bigint references public.doc_farm_cycles(id),
  status text not null,
  void text not null default '1',
  extra jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  updated_by uuid
);

grant select, update on public.doc_farm_cycles to authenticated;
grant select, update on public.flock_card to authenticated;

insert into public.doc_farm_cycles(id, farm_id, cycle_no, status)
values
  (1, 101, 1, 'Saved'),
  (2, 102, 1, 'Saved'),
  (3, 103, 1, 'Saved'),
  (4, 104, 1, 'Saved'),
  (5, 105, 1, 'Past Open'),
  (6, 106, 1, 'Saved');

-- Cycle 1 is incomplete at deployment time.
insert into public.flock_card(id, farm_cycle_id, status, extra, updated_at, updated_by)
values
  (11, 1, 'Closed', '{"closed_by_doc_type":"BR_CLEANUP"}', '2026-10-01 01:00:00+00', '11111111-1111-1111-1111-111111111111'),
  (12, 1, 'Saved', '{}', '2026-10-01 02:00:00+00', '22222222-2222-2222-2222-222222222222');

-- Cycle 2 must be repaired during deployment.
insert into public.flock_card(id, farm_cycle_id, status, extra, updated_at, updated_by)
values
  (21, 2, 'Closed', '{"closed_by_doc_type":"BR_CLEANUP"}', '2026-09-01 01:00:00+00', '11111111-1111-1111-1111-111111111111'),
  (22, 2, 'Closed', '{"closed_by_doc_type":"BR_CLEANUP"}', '2026-09-01 03:00:00+00', '22222222-2222-2222-2222-222222222222');

-- Cycle 3 has no participating cards and must remain open.

-- Cycle 4 was closed without Clean Up and must remain open.
insert into public.flock_card(id, farm_cycle_id, status, extra, updated_at)
values (41, 4, 'Closed', '{"closed_by_doc_type":"MANUAL"}', '2026-08-01 01:00:00+00');

-- Past Open cycles follow the same all-buildings-complete rule.
insert into public.flock_card(id, farm_cycle_id, status, extra, updated_at)
values (51, 5, 'Closed', '{"closed_by_doc_type":"BR_CLEANUP"}', '2026-07-01 01:00:00+00');

-- Voided cards do not participate in cycle completion.
insert into public.flock_card(id, farm_cycle_id, status, void, extra, updated_at)
values
  (61, 6, 'Closed', '1', '{"closed_by_doc_type":"BR_CLEANUP"}', '2026-06-01 01:00:00+00'),
  (62, 6, 'Saved', '0', '{}', '2026-06-02 01:00:00+00');
