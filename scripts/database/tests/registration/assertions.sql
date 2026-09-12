\set ON_ERROR_STOP on
-- Complete, established Super Admin and ordinary Admin fixtures.
insert into auth.users(id,email) values('00000000-0000-0000-0000-000000000001','admin@example.test');
insert into users(auth_id,email,isactive,user_type,firstname,lastname,birthdate,location,region,archipelago)
values('00000000-0000-0000-0000-000000000001','admin@example.test','1',1,'Admin','User','1990-01-01','Office','Region','Island');
insert into auth.users(id,email,raw_app_meta_data) values
 ('00000000-0000-0000-0000-000000000002','activate@example.test','{"registration_flow":"approval_first"}'),
 ('00000000-0000-0000-0000-000000000003','reject@example.test','{"registration_flow":"approval_first"}'),
 ('00000000-0000-0000-0000-000000000004','rollback@example.test','{"registration_flow":"approval_first"}');

do $$
begin
 if (select count(*) from users where approval_status='pending')<>3 then raise exception 'Pending registration missing'; end if;
 if (select count(*) from notification_outbox where event_key='USER_REGISTRATION_POSTED')<>3 then raise exception 'Signup events missing'; end if;
 if exists(select 1 from auth.users where raw_app_meta_data->>'registration_flow'='approval_first' and banned_until<=now()) then raise exception 'Pending account not banned'; end if;
 begin
  perform complete_registration_profile('00000000-0000-0000-0000-000000000002','{}');
  raise exception 'Pending profile write succeeded';
 exception when insufficient_privilege then null; end;
 begin
  perform decide_registration('00000000-0000-0000-0000-000000000002',(select id from users where email='activate@example.test'),'activate');
  raise exception 'Non-admin decision succeeded';
 exception when insufficient_privilege then null; end;
 begin
  perform decide_registration('00000000-0000-0000-0000-000000000001',(select id from users where email='reject@example.test'),'reject','');
  raise exception 'Empty rejection accepted';
 exception when raise_exception then if SQLERRM='Empty rejection accepted' then raise; end if; end;
end;
$$;

-- A failed signup rolls back Auth, pending profile and notification together.
alter table notification_outbox add constraint signup_failure_test check(document_no<>'signup-fail@example.test');
do $$ begin
 begin
  insert into auth.users(id,email,raw_app_meta_data) values('00000000-0000-0000-0000-000000000009','signup-fail@example.test','{"registration_flow":"approval_first"}');
  raise exception 'Expected signup failure';
 exception when check_violation then null; end;
 if exists(select 1 from auth.users where email='signup-fail@example.test') or exists(select 1 from users where email='signup-fail@example.test') then raise exception 'Signup failure left an orphan'; end if;
end $$;
alter table notification_outbox drop constraint signup_failure_test;

-- Decision and email insertion roll back together on queue failure.
alter table transactional_email_outbox add constraint reject_test check(recipient_email<>'rollback@example.test');
do $$
begin
 begin
  perform decide_registration('00000000-0000-0000-0000-000000000001',(select id from users where email='rollback@example.test'),'activate');
  raise exception 'Expected queue failure';
 exception when check_violation then null; end;
 if (select approval_status from users where email='rollback@example.test')<>'pending' then raise exception 'Failed decision persisted'; end if;
 if (select banned_until from auth.users where email='rollback@example.test') is null then raise exception 'Failed activation unbanned Auth'; end if;
 if exists(select 1 from notification_outbox where document_no='rollback@example.test' and event_key<>'USER_REGISTRATION_POSTED') then raise exception 'Failed decision emitted event'; end if;
end;
$$;
alter table transactional_email_outbox drop constraint reject_test;

select decide_registration('00000000-0000-0000-0000-000000000001',(select id from users where email='activate@example.test'),'activate');
select decide_registration('00000000-0000-0000-0000-000000000001',(select id from users where email='activate@example.test'),'activate');
select decide_registration('00000000-0000-0000-0000-000000000001',(select id from users where email='reject@example.test'),'reject','Not authorized');
select decide_registration('00000000-0000-0000-0000-000000000001',(select id from users where email='reject@example.test'),'reject','Not authorized');

do $$
begin
 if (select count(*) from transactional_email_outbox)<>2 then raise exception 'Decision retry duplicated email'; end if;
 if (select count(*) from notification_outbox where event_key<>'USER_REGISTRATION_POSTED')<>2 then raise exception 'Decision retry duplicated event'; end if;
 if (select banned_until from auth.users where email='activate@example.test') is not null then raise exception 'Activated account banned'; end if;
 if (select banned_until from auth.users where email='reject@example.test') is null then raise exception 'Rejected account unbanned'; end if;
 if has_function_privilege('authenticated','complete_registration_profile(uuid,jsonb)','execute') then raise exception 'Profile RPC exposed'; end if;
 if has_function_privilege('authenticated','decide_registration(uuid,bigint,text,text)','execute') then raise exception 'Decision RPC exposed'; end if;
end;
$$;

-- Dropping the JWT must not bypass the business gate. Keep the public password-reset insert.
set role anon;
select set_config('request.jwt.claim.role','anon',false);
select set_config('request.path','/business_test',false);
select set_config('request.method','GET',false);
do $$ begin
 if exists(select 1 from business_test) then raise exception 'Anonymous RLS bypass'; end if;
 begin perform check_registration_access(); raise exception 'Anonymous business access allowed';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.path','/approval_requests',false);
select set_config('request.method','POST',false);
select check_registration_access();
reset role;

-- Authenticated incomplete users cannot query business tables or bypass the pre-request hook.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select set_config('request.jwt.claim.role','authenticated',false);
do $$
begin
 if exists(select 1 from business_test) then raise exception 'RLS exposed business data'; end if;
 begin perform check_registration_access(); raise exception 'Pre-request allowed incomplete user';
 exception when insufficient_privilege then null; end;
end;
$$;
reset role;
select set_config('request.jwt.claim.role','service_role',false);

-- Invalid profiles emit nothing; successful completion changes no farm/role/approval fields.
do $$
begin
 begin
  perform complete_registration_profile('00000000-0000-0000-0000-000000000002','{"firstname":"A","lastname":"B","birthdate":"2026-02-30","location":"Office","region":"R","archipelago":"I"}');
  raise exception 'Invalid date accepted';
 exception when datetime_field_overflow then null; end;
 if (select registration_completed_at from users where email='activate@example.test') is not null then raise exception 'Failed profile persisted'; end if;
end;
$$;
select complete_registration_profile('00000000-0000-0000-0000-000000000002','{"firstname":"A","lastname":"B","birthdate":"1990-01-01","location":"Office","region":"R","archipelago":"I","user_type":1,"farm_id":999}');
select complete_registration_profile('00000000-0000-0000-0000-000000000002','{"firstname":"A","lastname":"B","birthdate":"1990-01-01","location":"Office","region":"R","archipelago":"I"}');
do $$
begin
 if (select user_type from users where email='activate@example.test')<>3 then raise exception 'Profile escalated role'; end if;
 if exists(select 1 from users_farms) then raise exception 'Profile changed farm assignments'; end if;
 if (select count(*) from notification_outbox where dedupe_key like '%:profile')<>1 then raise exception 'Completion retry duplicated event'; end if;
end;
$$;
set role authenticated;
select set_config('request.jwt.claim.role','authenticated',false);
select check_registration_access();
do $$ begin if (select count(*) from business_test)<>1 then raise exception 'Completed user blocked'; end if; end $$;
reset role;
select set_config('request.jwt.claim.role','service_role',false);

-- Dispatcher validates all three operations and applies central recipient rules.
select process_notification_outbox(100);
do $$ begin
 if exists(select 1 from notification_outbox where status<>'processed') then
  raise exception 'Dispatcher failed: %',(select string_agg(coalesce(last_error,status),'; ') from notification_outbox where status<>'processed');
 end if;
 if (select count(*) from user_notifications)<>3 then raise exception 'Expected only seeded signup notifications'; end if;
end $$;
select process_notification_outbox(100);
do $$ begin if (select count(*) from user_notifications)<>3 then raise exception 'Duplicate recipient delivery'; end if; end $$;
update notification_rules set is_active=false;
insert into auth.users(id,email,raw_app_meta_data) values('00000000-0000-0000-0000-000000000005','norule@example.test','{"registration_flow":"approval_first"}');
select process_notification_outbox(100);
do $$ begin if (select count(*) from user_notifications)<>3 then raise exception 'Inactive rule delivered'; end if; end $$;

-- Durable email claims, stale leases, retries and completion idempotence.
do $$ declare e transactional_email_outbox%rowtype; v_old_lease uuid; begin
 select * into e from claim_transactional_emails(1);
 v_old_lease:=e.lease_id;
 if (select count(*) from claim_transactional_emails(10))<>1 then raise exception 'Concurrent claim duplicated row'; end if;
 perform finish_transactional_email(e.id,e.lease_id,false,'simulated provider failure');
 if (select status from transactional_email_outbox where id=e.id)<>'failed' then raise exception 'Failed email lost'; end if;
 update transactional_email_outbox set next_attempt_at=now() where id=e.id;
 select * into e from claim_transactional_emails(1);
 perform finish_transactional_email(e.id,v_old_lease,true);
 if (select status from transactional_email_outbox where id=e.id)<>'processing' then raise exception 'Stale worker changed status'; end if;
 perform finish_transactional_email(e.id,e.lease_id,true);
 perform finish_transactional_email(e.id,e.lease_id,false,'late failure');
 if (select status from transactional_email_outbox where id=e.id)<>'sent' then raise exception 'Sent email retried'; end if;
end $$;
select 'Registration SQL assertions passed' as result;

-- Actual GoTrue ordering: INSERT first, application metadata UPDATE afterwards.
insert into auth.users(id,email) values('00000000-0000-0000-0000-000000000011','delayed@example.test');
update auth.users set raw_app_meta_data='{"registration_flow":"approval_first"}' where id='00000000-0000-0000-0000-000000000011';
do $$ begin
 if (select count(*) from users where email='delayed@example.test' and approval_status='pending')<>1 then raise exception 'Metadata UPDATE did not create pending registration'; end if;
 if (select count(*) from notification_outbox where document_no='delayed@example.test')<>1 then raise exception 'Metadata UPDATE did not enqueue signup'; end if;
end $$;
select decide_registration('00000000-0000-0000-0000-000000000001',(select id from users where email='delayed@example.test'),'activate');
update auth.users set raw_app_meta_data=raw_app_meta_data || '{"another_key":true}' where email='delayed@example.test';
do $$ begin
 if (select banned_until from auth.users where email='delayed@example.test') is not null then raise exception 'Metadata update rebanned activated account'; end if;
 if (select approval_status from users where email='delayed@example.test')<>'activated' then raise exception 'Metadata update reset decision'; end if;
 if (select count(*) from notification_outbox where document_no='delayed@example.test' and event_key='USER_REGISTRATION_POSTED')<>1 then raise exception 'Metadata update duplicated signup'; end if;
end $$;

-- Reproduce an account missed by the former insert-only trigger.
alter table auth.users disable trigger register_pending_auth_account;
insert into auth.users(id,email,raw_app_meta_data,banned_until) values('00000000-0000-0000-0000-000000000012','repair@example.test','{"registration_flow":"approval_first"}',now()+interval '100 years');
alter table auth.users enable trigger register_pending_auth_account;
\ir ../../../../app/signup_update/repair_registration_auth_metadata.sql
\ir ../../../../app/signup_update/repair_registration_auth_metadata.sql
do $$ begin
 if (select count(*) from users where email='repair@example.test' and approval_status='pending')<>1 then raise exception 'Repair did not recover missing registration'; end if;
 if (select count(*) from notification_outbox where document_no='repair@example.test')<>1 then raise exception 'Repair duplicated event'; end if;
 if (select banned_until from auth.users where email='delayed@example.test') is not null then raise exception 'Repair changed an existing activated account'; end if;
end $$;
select 'Auth metadata timing and repair assertions passed' as result;
