-- Simplified in-app notification delivery.
--
-- Deploy this after the existing notification system objects. Business modules
-- continue to publish their registered events to notification_outbox, while an
-- AFTER INSERT trigger immediately runs the centralized dispatcher. This keeps
-- existing module integrations, farm routing, permission checks, templates,
-- and deduplication without any browser poller or scheduled notification worker.

begin;

do $$
begin
  if to_regclass('public.notification_rules') is null
     or to_regclass('public.notification_outbox') is null
     or to_regclass('public.notification_email_deliveries') is null
     or to_regprocedure('public.process_notification_outbox(integer)') is null then
    raise exception 'Deploy the base notification system before simplify_notification_dispatch.sql.';
  end if;
end;
$$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Notification templates are in-app only. Transactional account email remains
-- independent in transactional_email_outbox.
update public.notification_rules
set email_enabled = false,
    updated_at = now()
where email_enabled;

update public.notification_email_deliveries
set status = 'skipped',
    processing_started_at = null,
    last_error = 'Notification template email delivery was disabled; use the in-app inbox.'
where status in ('pending', 'processing', 'failed');

alter table public.notification_rules
  drop constraint if exists notification_rules_in_app_only_check;

alter table public.notification_rules
  add constraint notification_rules_in_app_only_check
  check (not email_enabled);

create or replace function private.dispatch_notification_outbox_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_processed integer;
begin
  -- process_notification_outbox already performs authoritative source checks,
  -- centralized recipient resolution, permission/farm matching, and dedupe.
  -- Drain normal batches immediately, but never make a completed business
  -- action fail because notification delivery encountered an unexpected error.
  loop
    v_processed := public.process_notification_outbox(200);
    exit when v_processed < 200;
  end loop;

  return null;
exception when others then
  return null;
end;
$$;

revoke all on function private.dispatch_notification_outbox_after_insert()
  from public, anon, authenticated;

drop trigger if exists notification_outbox_dispatch_after_insert
  on public.notification_outbox;

create trigger notification_outbox_dispatch_after_insert
after insert on public.notification_outbox
for each statement
execute function private.dispatch_notification_outbox_after_insert();

commit;

-- 