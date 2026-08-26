-- Additive Workspace Timesheet Settings schema.
-- Apply before using /wks/settings/timesheet.

create table if not exists public.workspace_timesheet_settings (
  id smallint primary key default 1,
  default_activity_type_id bigint null,
  supervisor_user_id bigint null,
  supervisor_email text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  constraint workspace_timesheet_settings_singleton_check check (id = 1),
  constraint workspace_timesheet_settings_activity_fkey
    foreign key (default_activity_type_id)
    references public.activity_types(id)
    on update restrict
    on delete restrict,
  constraint workspace_timesheet_settings_supervisor_user_fkey
    foreign key (supervisor_user_id)
    references public.users(id)
    on update restrict
    on delete restrict,
  constraint workspace_timesheet_settings_email_check check (
    supervisor_email is null
    or supervisor_email = ''
    or supervisor_email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
  )
);

alter table public.workspace_timesheet_settings
  add column if not exists supervisor_user_id bigint null;

alter table public.workspace_timesheet_settings
  drop constraint if exists workspace_timesheet_settings_supervisor_user_fkey;

alter table public.workspace_timesheet_settings
  add constraint workspace_timesheet_settings_supervisor_user_fkey
  foreign key (supervisor_user_id)
  references public.users(id)
  on update restrict
  on delete restrict;

insert into public.workspace_timesheet_settings (id, default_activity_type_id, supervisor_user_id, supervisor_email)
select
  1,
  (
    select activity.id
    from public.activity_types activity
    where lower(btrim(activity.name)) = 'development'
    order by activity.id
    limit 1
  ),
  null,
  null
on conflict (id) do nothing;

create or replace function public.workspace_touch_timesheet_settings()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.id := 1;

  if new.supervisor_user_id is null then
    new.supervisor_email := null;
  else
    select lower(btrim(app_user.email))
    into new.supervisor_email
    from public.users app_user
    where app_user.id = new.supervisor_user_id
      and app_user.user_type in (1, 2)
      and btrim(coalesce(app_user.isactive::text, '')) = '1'
      and btrim(coalesce(app_user.email, '')) ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$';

    if new.supervisor_email is null then
      raise exception 'Supervisor must be an active Super Admin or Admin / Supervisor with a valid email.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists workspace_timesheet_settings_touch on public.workspace_timesheet_settings;
create trigger workspace_timesheet_settings_touch
before insert or update on public.workspace_timesheet_settings
for each row execute function public.workspace_touch_timesheet_settings();

alter table public.workspace_timesheet_settings enable row level security;

drop policy if exists workspace_timesheet_settings_select on public.workspace_timesheet_settings;
create policy workspace_timesheet_settings_select
on public.workspace_timesheet_settings for select
to authenticated
using (true);

drop policy if exists workspace_timesheet_settings_manage on public.workspace_timesheet_settings;
create policy workspace_timesheet_settings_manage
on public.workspace_timesheet_settings for all
to authenticated
using (
  exists (
    select 1 from public.users app_user
    where app_user.auth_id = auth.uid() and app_user.user_type = 1
  )
  or exists (
    select 1 from public.user_permissions permission_row
    where permission_row.user_id = auth.uid()
      and permission_row.ilink = '/wks/settings/timesheet/edit'
      and permission_row.is_visible = true
  )
)
with check (
  exists (
    select 1 from public.users app_user
    where app_user.auth_id = auth.uid() and app_user.user_type = 1
  )
  or exists (
    select 1 from public.user_permissions permission_row
    where permission_row.user_id = auth.uid()
      and permission_row.ilink = '/wks/settings/timesheet/edit'
      and permission_row.is_visible = true
  )
);

grant select, insert, update on public.workspace_timesheet_settings to authenticated;

notify pgrst, 'reload schema';
