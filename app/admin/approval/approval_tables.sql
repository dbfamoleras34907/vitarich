create table if not exists public.approval_templates (
  id bigint generated always as identity not null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_by uuid null,
  updated_at timestamp with time zone null,
  name text not null,
  document_type text not null,
  description text null,
  is_active boolean not null default true,
  rule_json jsonb not null default '{}'::jsonb,
  priority integer not null default 100,
  void text not null default '1',
  constraint approval_templates_pkey primary key (id),
  constraint approval_templates_document_name_key unique (document_type, name),
  constraint approval_templates_created_by_fkey foreign key (created_by) references auth.users (id),
  constraint approval_templates_updated_by_fkey foreign key (updated_by) references auth.users (id),
  constraint approval_templates_void_check check (void in ('0', '1'))
);

create table if not exists public.approval_stages (
  id bigint generated always as identity not null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_by uuid null,
  updated_at timestamp with time zone null,
  template_id bigint not null,
  stage_no integer not null,
  name text not null,
  approval_mode text not null default 'any',
  is_active boolean not null default true,
  void text not null default '1',
  constraint approval_stages_pkey primary key (id),
  constraint approval_stages_template_stage_key unique (template_id, stage_no),
  constraint approval_stages_template_id_fkey foreign key (template_id) references public.approval_templates (id) on delete cascade,
  constraint approval_stages_created_by_fkey foreign key (created_by) references auth.users (id),
  constraint approval_stages_updated_by_fkey foreign key (updated_by) references auth.users (id),
  constraint approval_stages_approval_mode_check check (approval_mode in ('any', 'all')),
  constraint approval_stages_void_check check (void in ('0', '1'))
);

create table if not exists public.approval_stage_approvers (
  id bigint generated always as identity not null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_by uuid null,
  updated_at timestamp with time zone null,
  stage_id bigint not null,
  approver_user_id bigint null,
  approver_auth_id uuid null,
  approver_type text not null default 'user',
  is_active boolean not null default true,
  void text not null default '1',
  constraint approval_stage_approvers_pkey primary key (id),
  constraint approval_stage_approvers_stage_id_fkey foreign key (stage_id) references public.approval_stages (id) on delete cascade,
  constraint approval_stage_approvers_approver_auth_id_fkey foreign key (approver_auth_id) references auth.users (id),
  constraint approval_stage_approvers_created_by_fkey foreign key (created_by) references auth.users (id),
  constraint approval_stage_approvers_updated_by_fkey foreign key (updated_by) references auth.users (id),
  constraint approval_stage_approvers_type_check check (approver_type in ('user', 'supervisor', 'role')),
  constraint approval_stage_approvers_target_check check (
    approver_type <> 'user'
    or approver_user_id is not null
    or approver_auth_id is not null
  ),
  constraint approval_stage_approvers_void_check check (void in ('0', '1'))
);

create table if not exists public.approval_template_triggers (
  id bigint generated always as identity not null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_by uuid null,
  updated_at timestamp with time zone null,
  template_id bigint not null,
  name text not null,
  users jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  void text not null default '1',
  constraint approval_template_triggers_pkey primary key (id),
  constraint approval_template_triggers_template_id_fkey foreign key (template_id) references public.approval_templates (id) on delete cascade,
  constraint approval_template_triggers_created_by_fkey foreign key (created_by) references auth.users (id),
  constraint approval_template_triggers_updated_by_fkey foreign key (updated_by) references auth.users (id),
  constraint approval_template_triggers_users_array_check check (jsonb_typeof(users) = 'array'),
  constraint approval_template_triggers_void_check check (void in ('0', '1'))
);

create table if not exists public.approval_template_approvers (
  id bigint generated always as identity not null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_by uuid null,
  updated_at timestamp with time zone null,
  template_id bigint not null,
  name text not null,
  users jsonb not null default '[]'::jsonb,
  approval_mode text not null default 'any',
  required_count integer not null default 1,
  is_active boolean not null default true,
  void text not null default '1',
  constraint approval_template_approvers_pkey primary key (id),
  constraint approval_template_approvers_template_id_fkey foreign key (template_id) references public.approval_templates (id) on delete cascade,
  constraint approval_template_approvers_created_by_fkey foreign key (created_by) references auth.users (id),
  constraint approval_template_approvers_updated_by_fkey foreign key (updated_by) references auth.users (id),
  constraint approval_template_approvers_users_array_check check (jsonb_typeof(users) = 'array'),
  constraint approval_template_approvers_mode_check check (approval_mode in ('any', 'count')),
  constraint approval_template_approvers_required_count_check check (required_count >= 1),
  constraint approval_template_approvers_void_check check (void in ('0', '1'))
);

create table if not exists public.approval_document_targets (
  id bigint generated always as identity not null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_by uuid null,
  updated_at timestamp with time zone null,
  document_type text not null,
  table_name text not null,
  id_column text not null default 'id',
  status_column text not null default 'approval_status',
  request_column text not null default 'approval_request_id',
  is_active boolean not null default true,
  void text not null default '1',
  constraint approval_document_targets_pkey primary key (id),
  constraint approval_document_targets_document_type_key unique (document_type),
  constraint approval_document_targets_void_check check (void in ('0', '1'))
);

create table if not exists public.approval_requests (
  id bigint generated always as identity not null,
  created_by text null,
  created_at timestamp with time zone not null default now(),
  updated_by uuid null,
  updated_at timestamp with time zone null,

  template_id bigint null,
  current_stage_id bigint null,

  document_type text null,
  document_id bigint null,
  document_no text null,
  document_payload jsonb null,

  requested_by_user_id bigint null,
  requested_by_auth_id uuid null,

  user_email text null,
  request_type text null,
  value_encrypted text null,

  status text not null default 'pending',
  remarks text null,
  approved_by bigint null,
  approved_by_auth_id uuid null,
  approved_at timestamp with time zone null,
  rejected_by bigint null,
  rejected_by_auth_id uuid null,
  rejected_at timestamp with time zone null,
  void text not null default '1',

  constraint approval_requests_pkey primary key (id),
  constraint approval_requests_template_id_fkey foreign key (template_id) references public.approval_templates (id),
  constraint approval_requests_current_stage_id_fkey foreign key (current_stage_id) references public.approval_stages (id),
  constraint approval_requests_updated_by_fkey foreign key (updated_by) references auth.users (id),
  constraint approval_requests_requested_by_auth_id_fkey foreign key (requested_by_auth_id) references auth.users (id),
  constraint approval_requests_approved_by_auth_id_fkey foreign key (approved_by_auth_id) references auth.users (id),
  constraint approval_requests_rejected_by_auth_id_fkey foreign key (rejected_by_auth_id) references auth.users (id),
  constraint approval_requests_status_check check (status in ('draft', 'pending', 'approved', 'rejected', 'cancelled')),
  constraint approval_requests_void_check check (void in ('0', '1'))
);

create table if not exists public.approval_request_steps (
  id bigint generated always as identity not null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_by uuid null,
  updated_at timestamp with time zone null,
  request_id bigint not null,
  stage_id bigint not null,
  stage_no integer not null,
  approver_user_id bigint null,
  approver_auth_id uuid null,
  status text not null default 'pending',
  remarks text null,
  decided_by bigint null,
  decided_by_auth_id uuid null,
  decided_at timestamp with time zone null,
  void text not null default '1',
  constraint approval_request_steps_pkey primary key (id),
  constraint approval_request_steps_request_id_fkey foreign key (request_id) references public.approval_requests (id) on delete cascade,
  constraint approval_request_steps_stage_id_fkey foreign key (stage_id) references public.approval_stages (id),
  constraint approval_request_steps_approver_auth_id_fkey foreign key (approver_auth_id) references auth.users (id),
  constraint approval_request_steps_decided_by_auth_id_fkey foreign key (decided_by_auth_id) references auth.users (id),
  constraint approval_request_steps_created_by_fkey foreign key (created_by) references auth.users (id),
  constraint approval_request_steps_updated_by_fkey foreign key (updated_by) references auth.users (id),
  constraint approval_request_steps_status_check check (status in ('pending', 'approved', 'rejected', 'skipped', 'cancelled')),
  constraint approval_request_steps_void_check check (void in ('0', '1'))
);

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'approval_templates',
        'approval_stages',
        'approval_stage_approvers',
        'approval_template_triggers',
        'approval_template_approvers',
        'approval_document_targets',
        'approval_requests',
        'approval_request_steps'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end;
$$;

alter table public.approval_templates
  add column if not exists void text not null default '1';

alter table public.approval_stages
  add column if not exists void text not null default '1';

alter table public.approval_stage_approvers
  add column if not exists void text not null default '1';

alter table public.approval_template_triggers
  drop constraint if exists approval_template_triggers_template_key;

alter table public.approval_template_triggers
  add column if not exists updated_by uuid null,
  add column if not exists updated_at timestamp with time zone null,
  add column if not exists users jsonb not null default '[]'::jsonb,
  add column if not exists is_active boolean not null default true,
  add column if not exists void text not null default '1';

alter table public.approval_template_approvers
  drop constraint if exists approval_template_approvers_template_key;

alter table public.approval_template_approvers
  add column if not exists updated_by uuid null,
  add column if not exists updated_at timestamp with time zone null,
  add column if not exists users jsonb not null default '[]'::jsonb,
  add column if not exists approval_mode text not null default 'any',
  add column if not exists required_count integer not null default 1,
  add column if not exists is_active boolean not null default true,
  add column if not exists void text not null default '1';

alter table public.approval_document_targets
  add column if not exists updated_by uuid null,
  add column if not exists updated_at timestamp with time zone null,
  add column if not exists id_column text not null default 'id',
  add column if not exists status_column text not null default 'approval_status',
  add column if not exists request_column text not null default 'approval_request_id',
  add column if not exists is_active boolean not null default true,
  add column if not exists void text not null default '1';

alter table public.approval_requests
  drop constraint if exists approval_requests_created_by_fkey;

alter table public.approval_requests
  add column if not exists updated_by uuid null,
  add column if not exists updated_at timestamp with time zone null,
  add column if not exists template_id bigint null,
  add column if not exists current_stage_id bigint null,
  add column if not exists document_type text null,
  add column if not exists document_id bigint null,
  add column if not exists document_no text null,
  add column if not exists document_payload jsonb null,
  add column if not exists requested_by_user_id bigint null,
  add column if not exists requested_by_auth_id uuid null,
  add column if not exists approved_by_auth_id uuid null,
  add column if not exists rejected_by bigint null,
  add column if not exists rejected_by_auth_id uuid null,
  add column if not exists rejected_at timestamp with time zone null,
  add column if not exists void text not null default '1';

alter table public.approval_request_steps
  add column if not exists void text not null default '1';

create index if not exists approval_templates_document_type_idx
  on public.approval_templates (document_type);

create index if not exists approval_templates_active_idx
  on public.approval_templates (is_active);

create index if not exists approval_templates_void_idx
  on public.approval_templates (void);

create index if not exists approval_stages_template_id_idx
  on public.approval_stages (template_id);

create index if not exists approval_stages_void_idx
  on public.approval_stages (void);

create index if not exists approval_stage_approvers_stage_id_idx
  on public.approval_stage_approvers (stage_id);

create index if not exists approval_stage_approvers_user_id_idx
  on public.approval_stage_approvers (approver_user_id);

create index if not exists approval_stage_approvers_auth_id_idx
  on public.approval_stage_approvers (approver_auth_id);

create index if not exists approval_stage_approvers_void_idx
  on public.approval_stage_approvers (void);

create index if not exists approval_template_triggers_template_id_idx
  on public.approval_template_triggers (template_id);

create unique index if not exists approval_template_triggers_active_template_uidx
  on public.approval_template_triggers (template_id)
  where void = '1';

create index if not exists approval_template_triggers_active_idx
  on public.approval_template_triggers (is_active);

create index if not exists approval_template_triggers_void_idx
  on public.approval_template_triggers (void);

create index if not exists approval_template_approvers_template_id_idx
  on public.approval_template_approvers (template_id);

create unique index if not exists approval_template_approvers_active_template_uidx
  on public.approval_template_approvers (template_id)
  where void = '1';

create index if not exists approval_template_approvers_active_idx
  on public.approval_template_approvers (is_active);

create index if not exists approval_template_approvers_void_idx
  on public.approval_template_approvers (void);

create index if not exists approval_document_targets_document_type_idx
  on public.approval_document_targets (document_type);

create index if not exists approval_document_targets_void_idx
  on public.approval_document_targets (void);

create index if not exists approval_requests_status_idx
  on public.approval_requests (status);

create index if not exists approval_requests_document_idx
  on public.approval_requests (document_type, document_id);

create index if not exists approval_requests_template_id_idx
  on public.approval_requests (template_id);

create index if not exists approval_requests_current_stage_id_idx
  on public.approval_requests (current_stage_id);

create index if not exists approval_requests_requested_by_user_id_idx
  on public.approval_requests (requested_by_user_id);

create index if not exists approval_requests_requested_by_auth_id_idx
  on public.approval_requests (requested_by_auth_id);

create index if not exists approval_requests_request_type_idx
  on public.approval_requests (request_type);

create index if not exists approval_requests_void_idx
  on public.approval_requests (void);

create index if not exists approval_request_steps_request_id_idx
  on public.approval_request_steps (request_id);

create index if not exists approval_request_steps_stage_id_idx
  on public.approval_request_steps (stage_id);

create index if not exists approval_request_steps_approver_user_id_idx
  on public.approval_request_steps (approver_user_id);

create index if not exists approval_request_steps_approver_auth_id_idx
  on public.approval_request_steps (approver_auth_id);

create index if not exists approval_request_steps_status_idx
  on public.approval_request_steps (status);

create index if not exists approval_request_steps_void_idx
  on public.approval_request_steps (void);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_approval_templates_updated_at'
  ) then
    create trigger set_approval_templates_updated_at
    before update on public.approval_templates
    for each row
    execute function public.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_approval_stages_updated_at'
  ) then
    create trigger set_approval_stages_updated_at
    before update on public.approval_stages
    for each row
    execute function public.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_approval_stage_approvers_updated_at'
  ) then
    create trigger set_approval_stage_approvers_updated_at
    before update on public.approval_stage_approvers
    for each row
    execute function public.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_approval_template_triggers_updated_at'
  ) then
    create trigger set_approval_template_triggers_updated_at
    before update on public.approval_template_triggers
    for each row
    execute function public.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_approval_template_approvers_updated_at'
  ) then
    create trigger set_approval_template_approvers_updated_at
    before update on public.approval_template_approvers
    for each row
    execute function public.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_approval_document_targets_updated_at'
  ) then
    create trigger set_approval_document_targets_updated_at
    before update on public.approval_document_targets
    for each row
    execute function public.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_approval_requests_updated_at'
  ) then
    create trigger set_approval_requests_updated_at
    before update on public.approval_requests
    for each row
    execute function public.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_approval_request_steps_updated_at'
  ) then
    create trigger set_approval_request_steps_updated_at
    before update on public.approval_request_steps
    for each row
    execute function public.set_updated_at();
  end if;
end;
$$;

create or replace function public.is_approval_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.auth_id = auth.uid()
      and lower(coalesce(u.issuper::text, '')) in ('1', 'true', 't', 'yes')
  );
$$;

create or replace function public.is_approval_request_actor(p_request_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.approval_requests ar
    where ar.id = p_request_id
      and (
        ar.void = '1'
        and (
        ar.created_by::text = auth.uid()::text
        or ar.requested_by_auth_id = auth.uid()
        or ar.approved_by_auth_id = auth.uid()
        or ar.rejected_by_auth_id = auth.uid()
        or exists (
          select 1
          from public.approval_request_steps ars
          where ars.request_id = ar.id
            and (
              ars.approver_auth_id = auth.uid()
              or ars.decided_by_auth_id = auth.uid()
            )
        )
        or exists (
          select 1
          from public.users approver
          join public.users requester
            on requester.supervisor = approver.id
          where approver.auth_id = auth.uid()
            and requester.email = ar.user_email
        )
        )
      )
  );
$$;

alter table public.approval_templates enable row level security;
alter table public.approval_stages enable row level security;
alter table public.approval_stage_approvers enable row level security;
alter table public.approval_template_triggers enable row level security;
alter table public.approval_template_approvers enable row level security;
alter table public.approval_document_targets enable row level security;
alter table public.approval_requests enable row level security;
alter table public.approval_request_steps enable row level security;

drop policy if exists approval_templates_select_authenticated on public.approval_templates;
create policy approval_templates_select_authenticated
  on public.approval_templates
  for select
  to authenticated
  using (void = '1');

drop policy if exists approval_templates_insert_admin on public.approval_templates;
create policy approval_templates_insert_admin
  on public.approval_templates
  for insert
  to authenticated
  with check (public.is_approval_admin());

drop policy if exists approval_templates_update_admin on public.approval_templates;
create policy approval_templates_update_admin
  on public.approval_templates
  for update
  to authenticated
  using (public.is_approval_admin())
  with check (public.is_approval_admin());

drop policy if exists approval_stages_select_authenticated on public.approval_stages;
create policy approval_stages_select_authenticated
  on public.approval_stages
  for select
  to authenticated
  using (void = '1');

drop policy if exists approval_stages_insert_admin on public.approval_stages;
create policy approval_stages_insert_admin
  on public.approval_stages
  for insert
  to authenticated
  with check (public.is_approval_admin());

drop policy if exists approval_stages_update_admin on public.approval_stages;
create policy approval_stages_update_admin
  on public.approval_stages
  for update
  to authenticated
  using (public.is_approval_admin())
  with check (public.is_approval_admin());

drop policy if exists approval_stage_approvers_select_authenticated on public.approval_stage_approvers;
create policy approval_stage_approvers_select_authenticated
  on public.approval_stage_approvers
  for select
  to authenticated
  using (void = '1');

drop policy if exists approval_stage_approvers_insert_admin on public.approval_stage_approvers;
create policy approval_stage_approvers_insert_admin
  on public.approval_stage_approvers
  for insert
  to authenticated
  with check (public.is_approval_admin());

drop policy if exists approval_stage_approvers_update_admin on public.approval_stage_approvers;
create policy approval_stage_approvers_update_admin
  on public.approval_stage_approvers
  for update
  to authenticated
  using (public.is_approval_admin())
  with check (public.is_approval_admin());

drop policy if exists approval_template_triggers_select_authenticated on public.approval_template_triggers;
create policy approval_template_triggers_select_authenticated
  on public.approval_template_triggers
  for select
  to authenticated
  using (void = '1');

drop policy if exists approval_template_triggers_insert_admin on public.approval_template_triggers;
create policy approval_template_triggers_insert_admin
  on public.approval_template_triggers
  for insert
  to authenticated
  with check (public.is_approval_admin());

drop policy if exists approval_template_triggers_update_admin on public.approval_template_triggers;
create policy approval_template_triggers_update_admin
  on public.approval_template_triggers
  for update
  to authenticated
  using (public.is_approval_admin())
  with check (public.is_approval_admin());

drop policy if exists approval_template_approvers_select_authenticated on public.approval_template_approvers;
create policy approval_template_approvers_select_authenticated
  on public.approval_template_approvers
  for select
  to authenticated
  using (void = '1');

drop policy if exists approval_template_approvers_insert_admin on public.approval_template_approvers;
create policy approval_template_approvers_insert_admin
  on public.approval_template_approvers
  for insert
  to authenticated
  with check (public.is_approval_admin());

drop policy if exists approval_template_approvers_update_admin on public.approval_template_approvers;
create policy approval_template_approvers_update_admin
  on public.approval_template_approvers
  for update
  to authenticated
  using (public.is_approval_admin())
  with check (public.is_approval_admin());

drop policy if exists approval_document_targets_select_authenticated on public.approval_document_targets;
create policy approval_document_targets_select_authenticated
  on public.approval_document_targets
  for select
  to authenticated
  using (void = '1');

drop policy if exists approval_document_targets_insert_admin on public.approval_document_targets;
create policy approval_document_targets_insert_admin
  on public.approval_document_targets
  for insert
  to authenticated
  with check (public.is_approval_admin());

drop policy if exists approval_document_targets_update_admin on public.approval_document_targets;
create policy approval_document_targets_update_admin
  on public.approval_document_targets
  for update
  to authenticated
  using (public.is_approval_admin())
  with check (public.is_approval_admin());

insert into public.approval_document_targets (
  document_type,
  table_name,
  id_column,
  status_column,
  request_column,
  is_active,
  void
)
values (
  'farm_setup_wizard',
  'farms',
  'id',
  'approval_status',
  'approval_request_id',
  true,
  '1'
)
on conflict (document_type) do update
set table_name = excluded.table_name,
    id_column = excluded.id_column,
    status_column = excluded.status_column,
    request_column = excluded.request_column,
    is_active = excluded.is_active,
    void = excluded.void;

drop policy if exists approval_requests_select_actor on public.approval_requests;
create policy approval_requests_select_actor
  on public.approval_requests
  for select
  to authenticated
  using (
    void = '1'
    and (
    public.is_approval_admin()
    or public.is_approval_request_actor(id)
    )
  );

drop policy if exists approval_requests_insert_requester on public.approval_requests;
create policy approval_requests_insert_requester
  on public.approval_requests
  for insert
  to anon, authenticated
  with check (
    (
      request_type = 'password_reset'
      and user_email is not null
      and value_encrypted is not null
    )
    or public.is_approval_admin()
    or created_by::text = auth.uid()::text
    or requested_by_auth_id = auth.uid()
  );

drop policy if exists approval_requests_update_actor on public.approval_requests;
create policy approval_requests_update_actor
  on public.approval_requests
  for update
  to authenticated
  using (
    public.is_approval_admin()
    or public.is_approval_request_actor(id)
  )
  with check (
    public.is_approval_admin()
    or public.is_approval_request_actor(id)
  );

drop policy if exists approval_request_steps_select_actor on public.approval_request_steps;
create policy approval_request_steps_select_actor
  on public.approval_request_steps
  for select
  to authenticated
  using (
    void = '1'
    and (
    public.is_approval_admin()
    or public.is_approval_request_actor(request_id)
    )
  );

drop policy if exists approval_request_steps_insert_admin on public.approval_request_steps;
create policy approval_request_steps_insert_admin
  on public.approval_request_steps
  for insert
  to authenticated
  with check (public.is_approval_admin());

drop policy if exists approval_request_steps_update_approver on public.approval_request_steps;
create policy approval_request_steps_update_approver
  on public.approval_request_steps
  for update
  to authenticated
  using (
    public.is_approval_admin()
    or approver_auth_id = auth.uid()
    or public.is_approval_request_actor(request_id)
  )
  with check (
    public.is_approval_admin()
    or approver_auth_id = auth.uid()
    or decided_by_auth_id = auth.uid()
  );
