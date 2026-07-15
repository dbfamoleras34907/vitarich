create or replace function public.check_approval_required(
  p_document_type text,
  p_requested_by_auth_id uuid default auth.uid(),
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_template public.approval_templates%rowtype;
begin
  select *
  into v_template
  from public.approval_templates
  where document_type = p_document_type
    and is_active = true
    and void = '1'
    and coalesce((rule_json ->> 'enabled')::boolean, true) = true
  order by priority asc, id asc
  limit 1;

  if not found then
    return jsonb_build_object(
      'required', false,
      'document_type', p_document_type
    );
  end if;

  return jsonb_build_object(
    'required', true,
    'template_id', v_template.id,
    'template_name', v_template.name,
    'document_type', p_document_type
  );
end;
$$;

create or replace function public.resolve_approval_stage_approvers(
  p_stage_id bigint,
  p_requested_by_auth_id uuid
)
returns table (
  approver_user_id bigint,
  approver_auth_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  with requester as (
    select u.id, u.auth_id, u.supervisor
    from public.users u
    where u.auth_id = p_requested_by_auth_id
    limit 1
  ),
  stage_approvers as (
    select asa.*
    from public.approval_stage_approvers asa
    where asa.stage_id = p_stage_id
      and asa.is_active = true
      and asa.void = '1'
  ),
  explicit_users as (
    select
      coalesce(asa.approver_user_id, u.id)::bigint as approver_user_id,
      coalesce(asa.approver_auth_id, u.auth_id)::uuid as approver_auth_id
    from stage_approvers asa
    left join public.users u
      on u.id = asa.approver_user_id
      or u.auth_id = asa.approver_auth_id
    where asa.approver_type = 'user'
  ),
  supervisors as (
    select
      supervisor.id::bigint as approver_user_id,
      supervisor.auth_id::uuid as approver_auth_id
    from stage_approvers asa
    cross join requester r
    join public.users supervisor
      on supervisor.id::text = r.supervisor::text
    where asa.approver_type = 'supervisor'
  )
  select distinct x.approver_user_id, x.approver_auth_id
  from (
    select * from explicit_users
    union all
    select * from supervisors
  ) x
  where x.approver_user_id is not null
     or x.approver_auth_id is not null;
$$;

create or replace function public.submit_for_approval(
  p_document_type text,
  p_document_id bigint,
  p_document_no text default null,
  p_requested_by_auth_id uuid default auth.uid(),
  p_payload jsonb default '{}'::jsonb,
  p_remarks text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template public.approval_templates%rowtype;
  v_stage public.approval_stages%rowtype;
  v_requester public.users%rowtype;
  v_request_id bigint;
  v_step_count integer;
begin
  select *
  into v_template
  from public.approval_templates
  where document_type = p_document_type
    and is_active = true
    and void = '1'
    and coalesce((rule_json ->> 'enabled')::boolean, true) = true
  order by priority asc, id asc
  limit 1;

  if not found then
    return jsonb_build_object(
      'success', false,
      'required', false,
      'message', 'No active approval template found.'
    );
  end if;

  select *
  into v_stage
  from public.approval_stages
  where template_id = v_template.id
    and is_active = true
    and void = '1'
  order by stage_no asc, id asc
  limit 1;

  if not found then
    raise exception 'Approval template % has no active stages.', v_template.id;
  end if;

  select *
  into v_requester
  from public.users
  where auth_id = p_requested_by_auth_id
  limit 1;

  insert into public.approval_requests (
    created_by,
    template_id,
    current_stage_id,
    document_type,
    document_id,
    document_no,
    document_payload,
    requested_by_user_id,
    requested_by_auth_id,
    user_email,
    request_type,
    status,
    remarks
  )
  values (
    p_requested_by_auth_id::text,
    v_template.id,
    v_stage.id,
    p_document_type,
    p_document_id,
    p_document_no,
    p_payload,
    v_requester.id,
    p_requested_by_auth_id,
    v_requester.email,
    p_document_type,
    'pending',
    p_remarks
  )
  returning id into v_request_id;

  insert into public.approval_request_steps (
    request_id,
    stage_id,
    stage_no,
    approver_user_id,
    approver_auth_id,
    status
  )
  select
    v_request_id,
    v_stage.id,
    v_stage.stage_no,
    approver_user_id,
    approver_auth_id,
    'pending'
  from public.resolve_approval_stage_approvers(v_stage.id, p_requested_by_auth_id);

  get diagnostics v_step_count = row_count;

  if v_step_count = 0 then
    update public.approval_requests
    set status = 'cancelled',
        remarks = coalesce(p_remarks || chr(10), '') || 'No approver resolved for first approval stage.'
    where id = v_request_id;

    raise exception 'No approver resolved for approval request %.', v_request_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'required', true,
    'request_id', v_request_id,
    'template_id', v_template.id,
    'stage_id', v_stage.id,
    'stage_no', v_stage.stage_no,
    'status', 'pending'
  );
end;
$$;

create or replace function public.approve_approval_request(
  p_request_id bigint,
  p_remarks text default null,
  p_approver_auth_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.approval_requests%rowtype;
  v_stage public.approval_stages%rowtype;
  v_approver public.users%rowtype;
  v_pending_count integer;
  v_next_stage public.approval_stages%rowtype;
  v_next_step_count integer;
begin
  select *
  into v_request
  from public.approval_requests
  where id = p_request_id
    and status = 'pending'
    and void = '1'
  for update;

  if not found then
    raise exception 'Pending approval request % not found.', p_request_id;
  end if;

  select *
  into v_stage
  from public.approval_stages
  where id = v_request.current_stage_id
    and void = '1';

  if not found then
    raise exception 'Current approval stage was not found for request %.', p_request_id;
  end if;

  select *
  into v_approver
  from public.users
  where auth_id = p_approver_auth_id
  limit 1;

  if not public.is_approval_admin() and not exists (
    select 1
    from public.approval_request_steps ars
    where ars.request_id = p_request_id
      and ars.stage_id = v_stage.id
      and ars.status = 'pending'
      and ars.void = '1'
      and (
        ars.approver_auth_id = p_approver_auth_id
        or ars.approver_user_id = v_approver.id
      )
  ) then
    raise exception 'User is not allowed to approve request %.', p_request_id;
  end if;

  update public.approval_request_steps ars
  set status = 'approved',
      remarks = p_remarks,
      decided_by = v_approver.id,
      decided_by_auth_id = p_approver_auth_id,
      decided_at = now()
  where ars.request_id = p_request_id
    and ars.stage_id = v_stage.id
    and ars.status = 'pending'
    and ars.void = '1'
    and (
      public.is_approval_admin()
      or ars.approver_auth_id = p_approver_auth_id
      or ars.approver_user_id = v_approver.id
    );

  if v_stage.approval_mode = 'any' then
    update public.approval_request_steps
    set status = 'skipped',
        decided_at = now()
    where request_id = p_request_id
      and stage_id = v_stage.id
      and status = 'pending'
      and void = '1';
  end if;

  select count(*)
  into v_pending_count
  from public.approval_request_steps
  where request_id = p_request_id
    and stage_id = v_stage.id
    and status = 'pending'
    and void = '1';

  if v_pending_count > 0 then
    return jsonb_build_object(
      'success', true,
      'request_id', p_request_id,
      'status', 'pending',
      'stage_id', v_stage.id,
      'stage_complete', false
    );
  end if;

  select *
  into v_next_stage
  from public.approval_stages
  where template_id = v_request.template_id
    and stage_no > v_stage.stage_no
    and is_active = true
    and void = '1'
  order by stage_no asc, id asc
  limit 1;

  if found then
    insert into public.approval_request_steps (
      request_id,
      stage_id,
      stage_no,
      approver_user_id,
      approver_auth_id,
      status
    )
    select
      p_request_id,
      v_next_stage.id,
      v_next_stage.stage_no,
      approver_user_id,
      approver_auth_id,
      'pending'
    from public.resolve_approval_stage_approvers(v_next_stage.id, v_request.requested_by_auth_id);

    get diagnostics v_next_step_count = row_count;

    if v_next_step_count = 0 then
      raise exception 'No approver resolved for next approval stage %.', v_next_stage.id;
    end if;

    update public.approval_requests
    set current_stage_id = v_next_stage.id
    where id = p_request_id;

    return jsonb_build_object(
      'success', true,
      'request_id', p_request_id,
      'status', 'pending',
      'stage_id', v_next_stage.id,
      'stage_complete', true,
      'request_complete', false
    );
  end if;

  update public.approval_requests
  set status = 'approved',
      approved_by = v_approver.id,
      approved_by_auth_id = p_approver_auth_id,
      approved_at = now()
  where id = p_request_id;

  return jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'status', 'approved',
    'stage_complete', true,
    'request_complete', true,
    'document_type', v_request.document_type,
    'document_id', v_request.document_id
  );
end;
$$;

create or replace function public.reject_approval_request(
  p_request_id bigint,
  p_remarks text default null,
  p_rejector_auth_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.approval_requests%rowtype;
  v_rejector public.users%rowtype;
begin
  select *
  into v_request
  from public.approval_requests
  where id = p_request_id
    and status = 'pending'
    and void = '1'
  for update;

  if not found then
    raise exception 'Pending approval request % not found.', p_request_id;
  end if;

  select *
  into v_rejector
  from public.users
  where auth_id = p_rejector_auth_id
  limit 1;

  if not public.is_approval_admin() and not exists (
    select 1
    from public.approval_request_steps ars
    where ars.request_id = p_request_id
      and ars.status = 'pending'
      and ars.void = '1'
      and (
        ars.approver_auth_id = p_rejector_auth_id
        or ars.approver_user_id = v_rejector.id
      )
  ) then
    raise exception 'User is not allowed to reject request %.', p_request_id;
  end if;

  update public.approval_request_steps ars
  set status = case
        when public.is_approval_admin()
          or ars.approver_auth_id = p_rejector_auth_id
          or ars.approver_user_id = v_rejector.id
        then 'rejected'
        else 'skipped'
      end,
      remarks = case
        when public.is_approval_admin()
          or ars.approver_auth_id = p_rejector_auth_id
          or ars.approver_user_id = v_rejector.id
        then p_remarks
        else remarks
      end,
      decided_by = case
        when public.is_approval_admin()
          or ars.approver_auth_id = p_rejector_auth_id
          or ars.approver_user_id = v_rejector.id
        then v_rejector.id
        else decided_by
      end,
      decided_by_auth_id = case
        when public.is_approval_admin()
          or ars.approver_auth_id = p_rejector_auth_id
          or ars.approver_user_id = v_rejector.id
        then p_rejector_auth_id
        else decided_by_auth_id
      end,
      decided_at = now()
  where ars.request_id = p_request_id
    and ars.status = 'pending'
    and ars.void = '1';

  update public.approval_requests
  set status = 'rejected',
      rejected_by = v_rejector.id,
      rejected_by_auth_id = p_rejector_auth_id,
      rejected_at = now(),
      remarks = coalesce(p_remarks, remarks)
  where id = p_request_id;

  return jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'status', 'rejected',
    'document_type', v_request.document_type,
    'document_id', v_request.document_id
  );
end;
$$;
