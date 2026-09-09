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
  v_trigger public.approval_template_triggers%rowtype;
  v_approver_config public.approval_template_approvers%rowtype;
  v_requester public.users%rowtype;
  v_can_trigger boolean;
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

  select *
  into v_requester
  from public.users
  where auth_id = p_requested_by_auth_id
  limit 1;

  select *
  into v_trigger
  from public.approval_template_triggers
  where template_id = v_template.id
    and is_active = true
    and void = '1'
  order by id asc
  limit 1;

  if not found then
    return jsonb_build_object(
      'required', false,
      'template_id', v_template.id,
      'template_name', v_template.name,
      'document_type', p_document_type,
      'message', 'No active approval trigger found.'
    );
  end if;

  select exists (
    select 1
    from jsonb_array_elements(v_trigger.users) trigger_user
    where nullif(trigger_user ->> 'auth_id', '')::uuid = p_requested_by_auth_id
       or nullif(trigger_user ->> 'user_id', '')::bigint = v_requester.id
  )
  into v_can_trigger;

  if not coalesce(v_can_trigger, false) then
    return jsonb_build_object(
      'required', false,
      'template_id', v_template.id,
      'template_name', v_template.name,
      'trigger_id', v_trigger.id,
      'document_type', p_document_type,
      'message', 'Requester is not included in the approval trigger.'
    );
  end if;

  select *
  into v_approver_config
  from public.approval_template_approvers
  where template_id = v_template.id
    and is_active = true
    and void = '1'
  order by id asc
  limit 1;

  if not found then
    return jsonb_build_object(
      'required', false,
      'template_id', v_template.id,
      'template_name', v_template.name,
      'trigger_id', v_trigger.id,
      'document_type', p_document_type,
      'message', 'No active approval approver setup found.'
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
  v_trigger public.approval_template_triggers%rowtype;
  v_approver_config public.approval_template_approvers%rowtype;
  v_stage public.approval_stages%rowtype;
  v_requester public.users%rowtype;
  v_request_id bigint;
  v_step_count integer;
  v_can_trigger boolean;
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
  into v_requester
  from public.users
  where auth_id = p_requested_by_auth_id
  limit 1;

  select *
  into v_trigger
  from public.approval_template_triggers
  where template_id = v_template.id
    and is_active = true
    and void = '1'
  order by id asc
  limit 1;

  if not found then
    return jsonb_build_object(
      'success', true,
      'required', false,
      'template_id', v_template.id,
      'message', 'No active approval trigger found.'
    );
  end if;

  select exists (
    select 1
    from jsonb_array_elements(v_trigger.users) trigger_user
    where nullif(trigger_user ->> 'auth_id', '')::uuid = p_requested_by_auth_id
       or nullif(trigger_user ->> 'user_id', '')::bigint = v_requester.id
  )
  into v_can_trigger;

  if not coalesce(v_can_trigger, false) then
    return jsonb_build_object(
      'success', true,
      'required', false,
      'template_id', v_template.id,
      'trigger_id', v_trigger.id,
      'message', 'Requester is not included in the approval trigger.'
    );
  end if;

  select *
  into v_approver_config
  from public.approval_template_approvers
  where template_id = v_template.id
    and is_active = true
    and void = '1'
  order by id asc
  limit 1;

  if not found then
    raise exception 'Approval template % has no active approver setup.', v_template.id;
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
    insert into public.approval_stages (
      created_by,
      template_id,
      stage_no,
      name,
      approval_mode,
      is_active,
      void
    )
    values (
      p_requested_by_auth_id,
      v_template.id,
      1,
      'Template Approval',
      case when v_approver_config.approval_mode = 'any' then 'any' else 'all' end,
      true,
      '1'
    )
    returning * into v_stage;
  end if;

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
  select distinct
    v_request_id,
    v_stage.id,
    v_stage.stage_no,
    nullif(approver_user ->> 'user_id', '')::bigint,
    nullif(approver_user ->> 'auth_id', '')::uuid,
    'pending'
  from jsonb_array_elements(v_approver_config.users) approver_user
  where nullif(approver_user ->> 'user_id', '') is not null
     or nullif(approver_user ->> 'auth_id', '') is not null;

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
    'trigger_id', v_trigger.id,
    'approver_id', v_approver_config.id,
    'stage_id', v_stage.id,
    'stage_no', v_stage.stage_no,
    'status', 'pending'
  );
end;
$$;

create or replace function public.set_approval_document_status(
  p_document_type text,
  p_document_id bigint,
  p_status text,
  p_request_id bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.approval_document_targets%rowtype;
  v_updated_count integer;
  v_has_approved_at boolean;
  v_has_rejected_at boolean;
begin
  if p_document_type is null or p_document_id is null then
    return false;
  end if;

  select *
  into v_target
  from public.approval_document_targets
  where document_type = p_document_type
    and is_active = true
    and void = '1'
  limit 1;

  if not found then
    return false;
  end if;

  execute format(
    'update public.%I set %I = $1, %I = $2 where %I = $3',
    v_target.table_name,
    v_target.status_column,
    v_target.request_column,
    v_target.id_column
  )
  using p_status, p_request_id, p_document_id;

  get diagnostics v_updated_count = row_count;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = v_target.table_name
      and column_name = 'approval_approved_at'
  )
  into v_has_approved_at;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = v_target.table_name
      and column_name = 'approval_rejected_at'
  )
  into v_has_rejected_at;

  if p_status = 'approved' and v_has_approved_at then
    execute format(
      'update public.%I set approval_approved_at = now() where %I = $1',
      v_target.table_name,
      v_target.id_column
    )
    using p_document_id;
  elsif p_status = 'rejected' and v_has_rejected_at then
    execute format(
      'update public.%I set approval_rejected_at = now() where %I = $1',
      v_target.table_name,
      v_target.id_column
    )
    using p_document_id;
  end if;

  return v_updated_count > 0;
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
  v_approver_config public.approval_template_approvers%rowtype;
  v_approver public.users%rowtype;
  v_pending_count integer;
  v_approved_count integer;
  v_required_count integer;
  v_has_approver_config boolean := false;
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

  select *
  into v_approver_config
  from public.approval_template_approvers
  where template_id = v_request.template_id
    and is_active = true
    and void = '1'
  order by id asc
  limit 1;
  v_has_approver_config := found;

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

  if v_has_approver_config and v_approver_config.approval_mode = 'any' then
    update public.approval_request_steps
    set status = 'skipped',
        decided_at = now()
    where request_id = p_request_id
      and stage_id = v_stage.id
      and status = 'pending'
      and void = '1';
  elsif v_has_approver_config and v_approver_config.approval_mode = 'count' then
    select count(*)
    into v_approved_count
    from public.approval_request_steps
    where request_id = p_request_id
      and stage_id = v_stage.id
      and status = 'approved'
      and void = '1';

    v_required_count := least(
      greatest(v_approver_config.required_count, 1),
      jsonb_array_length(v_approver_config.users)
    );

    if v_approved_count >= v_required_count then
      update public.approval_request_steps
      set status = 'skipped',
          decided_at = now()
      where request_id = p_request_id
        and stage_id = v_stage.id
        and status = 'pending'
        and void = '1';
    end if;
  elsif v_stage.approval_mode = 'any' then
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

  perform public.set_approval_document_status(
    v_request.document_type,
    v_request.document_id,
    'approved',
    p_request_id
  );

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

  perform public.set_approval_document_status(
    v_request.document_type,
    v_request.document_id,
    'rejected',
    p_request_id
  );

  return jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'status', 'rejected',
    'document_type', v_request.document_type,
    'document_id', v_request.document_id
  );
end;
$$;
