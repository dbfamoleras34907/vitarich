begin;

-- Git-derived Task and Timeline entries for 2026-08-31 through 2026-09-04.
-- Work schedule: 08:00-12:00 (4 hours), 13:00-18:00 (5 hours).
-- Total: 9 hours per day, 45 hours for five workdays.
-- Hours and work dates are estimated allocations, not time measured by Git.
-- Evidence and review: docs/tickets-timesheets-2026-08-31-to-2026-09-04.md
--
-- Git author: dbfamoleras34907 <famolerasd@gmail.com>
-- Git evidence exists on September 1, 3, and 4. August 31 and September 2
-- contain work distributed from the changes completed in the following commits.

create temporary table task_timeline_config (
  owner_id bigint not null,
  project_id bigint not null,
  activity_type_id bigint not null,
  task_type_id bigint not null
) on commit drop;

-- Existing Workspace values used by the earlier Task/Timeline records:
-- owner_id = 1 (Deanmark Batucan Famoleras), project_id = 4 (Broiler),
-- activity_type_id = 1,
-- task_type_id = 1.
insert into task_timeline_config values (1, 4, 1, 1);

do $validation$
declare
  config task_timeline_config%rowtype;
begin
  select * into strict config from task_timeline_config;

  if not exists (
    select 1
    from public.users app_user
    where app_user.id = config.owner_id
  ) then
    raise exception 'Workspace user id % does not exist.', config.owner_id;
  end if;

  if not exists (
    select 1
    from public.projects project
    where project.id = config.project_id
      and coalesce(project.void, 1) = 1
  ) then
    raise exception 'Active Workspace project id % does not exist.', config.project_id;
  end if;

  if not exists (
    select 1
    from public.activity_types activity
    where activity.id = config.activity_type_id
  ) then
    raise exception 'Activity Type id % does not exist.', config.activity_type_id;
  end if;

  if not exists (
    select 1
    from public.task_types task_type
    where task_type.id = config.task_type_id
      and coalesce(task_type.void, 1) = 1
  ) then
    raise exception 'Active Task Type id % does not exist.', config.task_type_id;
  end if;
end;
$validation$;

-- The tasks trigger requires at least one active workflow status. If this
-- deployment has none, create or reactivate the canonical default status.
insert into public.workspace_task_statuses (
  code,
  name,
  color,
  sort_order,
  is_final,
  void
)
select
  'TODO',
  'To Do',
  '#64748b',
  10,
  false,
  1
where not exists (
  select 1
  from public.workspace_task_statuses status_row
  where status_row.void = 1
)
on conflict (code) do update
set
  void = 1,
  updated_at = now();

do $status_validation$
begin
  if not exists (
    select 1
    from public.workspace_task_statuses status_row
    where status_row.void = 1
  ) then
    raise exception 'At least one active Workspace task status is required.';
  end if;
end;
$status_validation$;

create temporary table git_task_seed (
  subject text primary key,
  issue text not null,
  color text not null,
  created_at timestamptz not null
) on commit drop;

insert into git_task_seed (subject, issue, color, created_at)
values
  (
    'Goods Receipt Excel import and export',
    'Implemented the Stock In item-line spreadsheet template, validated Excel dropdowns, import parsing, expiry-date derivation, and atomic append behavior.',
    '#0891B2',
    timestamptz '2026-08-31 08:00:00+08'
  ),
  (
    'Excel-style table editing and navigation',
    'Implemented the reusable Excel table grid with compact rows, inline editing, selection, keyboard navigation, copy and paste, resizing, and horizontal scrolling.',
    '#7C3AED',
    timestamptz '2026-08-31 13:00:00+08'
  ),
  (
    'Five-level Item Group hierarchy',
    'Implemented optional five-level Item Group and subgroup maintenance, hierarchy validation, leaf selection, dependency-safe voiding, and Item Master integration.',
    '#2563EB',
    timestamptz '2026-09-01 13:00:00+08'
  ),
  (
    'Atomic Item Master spreadsheet import',
    'Implemented transactional Item Master Excel import with row validation, duplicate skipping, subgroup persistence, advisory locking, code allocation, and rollback on error.',
    '#DC2626',
    timestamptz '2026-09-02 13:00:00+08'
  ),
  (
    'Compact Item Master grid and Stock In integration',
    'Refined the compact Item Master grid, five-level subgroup cascade, import template, Stock In group display, shared repositories, and horizontal scrolling behavior.',
    '#EA580C',
    timestamptz '2026-09-03 13:00:00+08'
  ),
  (
    'Vaccination and Meds inventory module',
    'Implemented the Vaccination and Meds module with Draft, Post, Edit, and Void flows, assigned farms, warehouse and pen selection, FIFO inventory allocation, settings, navigation, and notification readiness.',
    '#16A34A',
    timestamptz '2026-09-04 08:00:00+08'
  );

insert into public.tasks (
  project_id,
  subject,
  issue,
  priority,
  task_type,
  parent_task,
  color,
  assigned_to,
  status_id,
  void,
  created_at
)
select
  config.project_id,
  seed.subject,
  seed.issue,
  'high',
  config.task_type_id,
  null,
  seed.color,
  config.owner_id,
  (
    select status_row.id
    from public.workspace_task_statuses status_row
    where status_row.void = 1
    order by status_row.sort_order, status_row.id
    limit 1
  ),
  1,
  seed.created_at
from git_task_seed seed
cross join task_timeline_config config
where not exists (
  select 1
  from public.tasks existing
  where existing.project_id = config.project_id
    and existing.subject = seed.subject
);

create temporary table git_timeline_seed (
  work_date date not null,
  slot integer not null,
  task_subject text not null references git_task_seed(subject),
  from_time time not null,
  hrs numeric(10, 2) not null,
  remarks text not null,
  primary key (work_date, slot)
) on commit drop;

insert into git_timeline_seed (
  work_date,
  slot,
  task_subject,
  from_time,
  hrs,
  remarks
)
values
  (
    date '2026-08-31', 1,
    'Goods Receipt Excel import and export',
    time '08:00:00', 4.00,
    'Built the Stock In Excel template, dropdown validations, import parser, and automatic expiry-date handling.'
  ),
  (
    date '2026-08-31', 2,
    'Excel-style table editing and navigation',
    time '13:00:00', 5.00,
    'Developed the reusable compact Excel grid, editing, selection, keyboard navigation, copy and paste, resizing, and scrolling.'
  ),
  (
    date '2026-09-01', 1,
    'Goods Receipt Excel import and export',
    time '08:00:00', 4.00,
    'Integrated and refined validated Excel import and export for Goods Receipt item lines and Stock In behavior.'
  ),
  (
    date '2026-09-01', 2,
    'Five-level Item Group hierarchy',
    time '13:00:00', 5.00,
    'Added five-level subgroup selection, hierarchy maintenance, leaf rules, and Item Master persistence.'
  ),
  (
    date '2026-09-02', 1,
    'Five-level Item Group hierarchy',
    time '08:00:00', 4.00,
    'Refined hierarchy validation, full-path selectors, server-authorized mutations, and dependency-safe void behavior.'
  ),
  (
    date '2026-09-02', 2,
    'Atomic Item Master spreadsheet import',
    time '13:00:00', 5.00,
    'Developed the transactional import design, row-level validation, duplicate-skip behavior, locking, and rollback safeguards.'
  ),
  (
    date '2026-09-03', 1,
    'Atomic Item Master spreadsheet import',
    time '08:00:00', 4.00,
    'Completed the atomic Item Master import RPC, authorized API, code allocation, subgroup persistence, and error reporting.'
  ),
  (
    date '2026-09-03', 2,
    'Compact Item Master grid and Stock In integration',
    time '13:00:00', 5.00,
    'Refined the compact Item Master grid, import workbook, subgroup cascade, repositories, and Stock In group display.'
  ),
  (
    date '2026-09-04', 1,
    'Vaccination and Meds inventory module',
    time '08:00:00', 4.00,
    'Implemented the VNM schema, repositories, farm and warehouse rules, FIFO allocation, posting, and void reversal.'
  ),
  (
    date '2026-09-04', 2,
    'Vaccination and Meds inventory module',
    time '13:00:00', 5.00,
    'Built VNM list, create, edit, view, settings, navigation, permissions, and centralized notification event registration.'
  );

insert into public.timesheets (
  doc_date,
  assigned_to,
  status,
  void,
  created_at
)
select
  workday.work_date,
  config.owner_id,
  'Draft',
  1,
  workday.work_date::timestamp + time '18:00:00'
from (
  select distinct work_date
  from git_timeline_seed
) workday
cross join task_timeline_config config
where not exists (
  select 1
  from public.timesheets existing
  where existing.doc_date = workday.work_date
    and existing.assigned_to = config.owner_id
    and existing.void = 1
);

do $header_validation$
declare
  duplicate_date date;
begin
  select header.doc_date
  into duplicate_date
  from public.timesheets header
  cross join task_timeline_config config
  where header.assigned_to = config.owner_id
    and header.void = 1
    and header.doc_date between date '2026-08-31' and date '2026-09-04'
  group by header.doc_date
  having count(*) > 1
  order by header.doc_date
  limit 1;

  if duplicate_date is not null then
    raise exception
      'More than one active timesheet header exists for owner % on %.',
      (select owner_id from task_timeline_config),
      duplicate_date;
  end if;
end;
$header_validation$;

-- Reuse an existing active daily header when present. Missing lines are appended
-- after its current maximum line number and are deduplicated on rerun.
with missing_lines as (
  select
    header.id as docentry,
    seed.work_date,
    seed.slot,
    config.project_id,
    task.id as task_id,
    config.activity_type_id,
    seed.from_time,
    seed.hrs,
    seed.remarks
  from git_timeline_seed seed
  cross join task_timeline_config config
  join public.timesheets header
    on header.doc_date = seed.work_date
   and header.assigned_to = config.owner_id
   and header.void = 1
  join lateral (
    select existing_task.id
    from public.tasks existing_task
    where existing_task.project_id = config.project_id
      and existing_task.subject = seed.task_subject
    order by coalesce(existing_task.void, 1) desc, existing_task.id
    limit 1
  ) task on true
  where not exists (
    select 1
    from public.timesheet_lines existing
    where existing.docentry = header.id
      and existing.task_id = task.id
      and existing.from_time = seed.from_time
      and existing.hrs = seed.hrs
      and existing.void = 1
  )
),
numbered_missing_lines as (
  select
    missing.*,
    coalesce(current_lines.max_line_num, 0)
      + row_number() over (
          partition by missing.docentry
          order by missing.slot
        ) as line_num
  from missing_lines missing
  left join lateral (
    select max(existing.line_num) as max_line_num
    from public.timesheet_lines existing
    where existing.docentry = missing.docentry
  ) current_lines on true
)
insert into public.timesheet_lines (
  docentry,
  line_num,
  project_id,
  task_id,
  activity_type,
  from_time,
  hrs,
  remarks,
  void
)
select
  missing.docentry,
  missing.line_num,
  missing.project_id,
  missing.task_id,
  missing.activity_type_id,
  missing.from_time,
  missing.hrs,
  missing.remarks,
  1
from numbered_missing_lines missing;

-- Expected result: five rows, each totaling 9.00 hours; grand total 45.00.
select
  header.doc_date,
  sum(line.hrs) as inserted_hours
from public.timesheets header
join public.timesheet_lines line
  on line.docentry = header.id
cross join task_timeline_config config
where header.assigned_to = config.owner_id
  and header.void = 1
  and line.void = 1
  and exists (
    select 1
    from git_timeline_seed seed
    join public.tasks task on task.id = line.task_id
    where seed.work_date = header.doc_date
      and seed.task_subject = task.subject
      and line.project_id = config.project_id
      and task.project_id = config.project_id
      and seed.from_time = line.from_time
      and seed.hrs = line.hrs
  )
group by header.doc_date
order by header.doc_date;

select sum(line.hrs) as inserted_grand_total
from public.timesheet_lines line
join public.timesheets header
  on header.id = line.docentry
cross join task_timeline_config config
where header.assigned_to = config.owner_id
  and header.void = 1
  and line.void = 1
  and exists (
    select 1
    from git_timeline_seed seed
    join public.tasks task on task.id = line.task_id
    where seed.work_date = header.doc_date
      and seed.task_subject = task.subject
      and line.project_id = config.project_id
      and task.project_id = config.project_id
      and seed.from_time = line.from_time
      and seed.hrs = line.hrs
  );

commit;
