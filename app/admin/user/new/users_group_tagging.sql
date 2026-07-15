alter table public.users
  add column if not exists users_group_id bigint null;

alter table public.users
  drop constraint if exists users_users_group_id_fkey;

alter table public.users
  add constraint users_users_group_id_fkey
  foreign key (users_group_id)
  references public.users_group (id);

create index if not exists users_users_group_id_idx
  on public.users (users_group_id);
