-- Manual Cycle Master Force Close and reopen audit/notification support.
-- Apply after the centralized notification system and the current Cycle Master ownership migration.
begin;

alter table public.doc_farm_cycles
  add column if not exists force_closed_on date null,
  add column if not exists force_close_reason text null,
  add column if not exists force_closed_flock_card_ids bigint[] not null default '{}'::bigint[],
  add column if not exists notification_revision integer not null default 0;

alter table public.doc_farm_cycles
  drop constraint if exists doc_farm_cycles_status_check;
alter table public.doc_farm_cycles
  add constraint doc_farm_cycles_status_check
  check (status in ('Saved', 'Past Open', 'Closed', 'Force Closed', 'Cancelled'));

alter table public.doc_farm_cycles
  drop constraint if exists doc_farm_cycles_force_close_reason_check;
alter table public.doc_farm_cycles
  add constraint doc_farm_cycles_force_close_reason_check
  check (force_close_reason is null or length(btrim(force_close_reason)) between 1 and 1000);

alter table public.doc_farm_cycles
  drop constraint if exists doc_farm_cycles_notification_revision_check;
alter table public.doc_farm_cycles
  add constraint doc_farm_cycles_notification_revision_check
  check (notification_revision >= 0);

drop function if exists public.set_broiler_farm_cycle_state(bigint, text);
drop function if exists public.set_broiler_farm_cycle_state(bigint, text, date, text);

create function public.set_broiler_farm_cycle_state(
  p_farm_cycle_id bigint,
  p_action text,
  p_closed_on date default null,
  p_reason text default null
) returns public.doc_farm_cycles
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_user public.users%rowtype;
  v_cycle public.doc_farm_cycles%rowtype;
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_reason text := btrim(coalesce(p_reason, ''));
  v_occurred_at timestamptz := clock_timestamp();
  v_force_closed_card_ids bigint[] := '{}'::bigint[];
  v_was_force_closed boolean;
begin
  if v_actor is null then
    raise exception 'An authenticated user is required to manage Broiler cycles.' using errcode = '42501';
  end if;

  select * into v_user
  from public.users app_user
  where app_user.auth_id = v_actor
    and coalesce(btrim(app_user.isactive::text), '1') = '1';

  if not found or (
    coalesce(v_user.user_type, 3) <> 1
    and not exists (
      select 1 from public.user_permissions permission
      where permission.user_id = v_actor
        and permission.ilink = '/brd/cycle-master/edit'
        and permission.is_visible
    )
  ) then
    raise exception 'You do not have permission to manage Cycle Master.' using errcode = '42501';
  end if;

  select * into v_cycle
  from public.doc_farm_cycles cycle
  where cycle.id = p_farm_cycle_id
  for update;
  if not found then raise exception 'The Broiler cycle was not found.'; end if;

  if coalesce(v_user.user_type, 3) <> 1 and not exists (
    select 1 from public.users_farms assignment
    where assignment.users_id = v_user.id
      and assignment.farm_id = v_cycle.farm_id
      and coalesce(btrim(assignment.void::text), '1') = '1'
  ) then
    raise exception 'You do not have access to this cycle farm.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(73191, v_cycle.farm_id::integer);

  if v_action = 'close' then
    if v_cycle.status not in ('Saved', 'Past Open') then
      raise exception 'Only a Current Cycle or Past Open Cycle can be force closed.';
    end if;
    if p_closed_on is null then raise exception 'Enter the closing date.'; end if;
    if length(v_reason) not between 1 and 1000 then
      raise exception 'Enter a reason between 1 and 1000 characters.';
    end if;

    -- Remember only cards that this action closes. A later reopen must not
    -- reactivate cards that had already completed through Clean Up.
    select coalesce(array_agg(card.id order by card.id), '{}'::bigint[])
    into v_force_closed_card_ids
    from public.flock_card card
    where card.farm_cycle_id = v_cycle.id and card.void = '1' and card.status = 'Saved';

    -- Force Close intentionally does not inspect unfinished module transactions.
    update public.flock_card
    set status = 'Closed', updated_at = v_occurred_at, updated_by = v_actor
    where farm_cycle_id = v_cycle.id and void = '1' and status = 'Saved';

    update public.doc_farm_cycles
    set status = 'Force Closed', closed_at = v_occurred_at, closed_by = v_actor,
        force_closed_on = p_closed_on, force_close_reason = v_reason,
        force_closed_flock_card_ids = v_force_closed_card_ids,
        notification_revision = notification_revision + 1,
        updated_at = v_occurred_at, updated_by = v_actor
    where id = v_cycle.id
    returning * into v_cycle;
  elsif v_action = 'reopen' then
    if v_cycle.status not in ('Closed', 'Force Closed') then
      raise exception 'Only a Closed or Force Closed Cycle can be reopened.';
    end if;

    v_was_force_closed := v_cycle.status = 'Force Closed';

    update public.doc_farm_cycles
    set status = 'Past Open', reopened_at = v_occurred_at, reopened_by = v_actor,
        notification_revision = notification_revision + 1,
        updated_at = v_occurred_at, updated_by = v_actor
    where id = v_cycle.id
    returning * into v_cycle;

    update public.flock_card
    set status = 'Saved', updated_at = v_occurred_at, updated_by = v_actor
    where farm_cycle_id = v_cycle.id and void = '1' and status = 'Closed'
      and (
        not v_was_force_closed
        or id = any(coalesce(v_cycle.force_closed_flock_card_ids, '{}'::bigint[]))
      );
  else
    raise exception 'Cycle action must be close or reopen.';
  end if;

  return v_cycle;
end;
$$;

revoke all on function public.set_broiler_farm_cycle_state(bigint, text, date, text) from public, anon;
grant execute on function public.set_broiler_farm_cycle_state(bigint, text, date, text) to authenticated;

create or replace function public.enqueue_cycle_master_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text := case when new.status = 'Force Closed' then 'force_closed' else 'reopened' end;
begin
  insert into public.notification_outbox (
    module_key, event_key, entity_type, entity_id, document_no, fms_type,
    farm_id, recipient_farm_id, actor_auth_id, target_url,
    permission_group, permission_title, title, message, priority,
    posting_version, metadata, dedupe_key, occurred_at
  ) values (
    'CYCLE_MASTER', 'CYCLE_MASTER_EDITED', 'doc_farm_cycles', new.id::text,
    coalesce(nullif(new.cycle_mask, ''), new.cycle_no::text), 'Broiler',
    new.farm_id, new.farm_id, auth.uid(), '/brd/cycle-master',
    'Menus', 'Cycle Master/view',
    case when v_action = 'force_closed' then 'Cycle force closed' else 'Cycle reopened' end,
    case when v_action = 'force_closed'
      then 'Cycle {document_no} was force closed by {initiator_name}.'
      else 'Cycle {document_no} was reopened as a Past Open Cycle by {initiator_name}.' end,
    'normal', new.notification_revision,
    jsonb_strip_nulls(jsonb_build_object(
      'action', v_action,
      'status', new.status,
      'closedOn', new.force_closed_on,
      'reason', case when v_action = 'force_closed' then new.force_close_reason else null end
    )),
    'CYCLE_MASTER_EDITED:' || new.id || ':' || new.notification_revision,
    coalesce(new.updated_at, now())
  ) on conflict (dedupe_key) do nothing;
  return new;
end;
$$;

revoke all on function public.enqueue_cycle_master_event() from public, anon, authenticated;
drop trigger if exists cycle_master_enqueue_event on public.doc_farm_cycles;
create trigger cycle_master_enqueue_event
after update of notification_revision on public.doc_farm_cycles
for each row when (new.notification_revision > old.notification_revision)
execute function public.enqueue_cycle_master_event();

-- Add authoritative Cycle Master validation to the installed central dispatcher.
do $patch$
declare
  v_definition text;
  v_anchor_position integer;
begin
  if to_regprocedure('public.process_notification_outbox(integer)') is null then
    raise exception 'Apply the current centralized notification_system.sql first.';
  end if;
  select pg_get_functiondef('public.process_notification_outbox(integer)'::regprocedure) into v_definition;
  if position('CYCLE_MASTER_EDITED' in v_definition) = 0 then
    -- Dispatcher module order varies between deployed notification versions.
    -- Insert before the first module-specific elsif instead of depending on
    -- BR_CLEANUP (which older installations do not yet contain).
    v_anchor_position := position('elsif v_event.module_key' in lower(v_definition));
    if v_anchor_position = 0 then
      raise exception 'The centralized notification dispatcher has no module validation anchor.';
    end if;
    v_definition := overlay(v_definition placing
      $branch$elsif v_event.module_key = 'CYCLE_MASTER'
            and v_event.event_key = 'CYCLE_MASTER_EDITED' then
        select exists (
          select 1 from public.doc_farm_cycles cycle
          join public.farms farm on farm.id = cycle.farm_id
          where cycle.id::text = v_event.entity_id
            and cycle.farm_id = v_event.farm_id
            and cycle.farm_id = v_event.recipient_farm_id
            and v_event.entity_type = 'doc_farm_cycles'
            and v_event.fms_type = 'Broiler'
            and v_event.permission_group = 'Menus'
            and v_event.permission_title = 'Cycle Master/view'
            and upper(btrim(farm.farm_type)) in ('BR', 'BROILER')
            and v_event.posting_version > 0
            and cycle.notification_revision >= v_event.posting_version
            and v_event.dedupe_key = v_event.event_key || ':' || cycle.id || ':' || v_event.posting_version
            and v_event.metadata->>'action' in ('force_closed', 'reopened')
        ) into v_source_valid;
        if not coalesce(v_source_valid, false) then
          update public.notification_outbox
          set status = 'invalid', processed_at = now(), processing_started_at = null,
              last_error = 'Cycle Master event does not match its persisted canonical farm or revision.'
          where id = v_event.id;
          continue;
        end if;
      $branch$
      from v_anchor_position for 0);
    execute v_definition;
  end if;
end;
$patch$;

notify pgrst, 'reload schema';
commit;
