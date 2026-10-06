-- Apply app/admin/notifications/notification_system.sql first.
-- Run this migration before deploying the Default UoM UI and reference readers.
begin;

alter table public.uom_groups
  add column if not exists default_uom_id bigint references public.uom_master_data(id),
  add column if not exists creation_request_id uuid;
update public.uom_groups set default_uom_id = base_uom_id where default_uom_id is null;
alter table public.uom_groups alter column default_uom_id set not null;
create unique index if not exists uom_groups_creation_request_idx
  on public.uom_groups(creation_request_id) where creation_request_id is not null;

-- Invoker RPCs retain existing grants and RLS for both tables.
create or replace function public.save_uom_group(p_id bigint, p_payload jsonb)
returns bigint language plpgsql security invoker set search_path = public as $$
declare
  v_group public.uom_groups%rowtype;
  v_id bigint := p_id;
  v_actor uuid := auth.uid();
  v_base bigint := (p_payload->>'base_uom_id')::bigint;
  v_default bigint := (p_payload->>'default_uom_id')::bigint;
  v_request uuid := (p_payload->>'request_id')::uuid;
  v_rows jsonb;
  v_existing jsonb;
  v_now timestamptz := clock_timestamp();
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if v_request is null then raise exception 'Request identity is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_request::text, 0));
  if v_id is null then
    select id into v_id from public.uom_groups where creation_request_id = v_request;
    if found then return v_id; end if;
  end if;
  if nullif(btrim(p_payload->>'code'), '') is null
     or nullif(btrim(p_payload->>'name'), '') is null
     or v_base is null or v_default is null then
    raise exception 'Group code, name, base UoM and default UoM are required';
  end if;
  if jsonb_typeof(p_payload->'conversions') is distinct from 'array' then
    raise exception 'Conversion rows are required';
  end if;
  select jsonb_agg(jsonb_build_object('uom_id', r.uom_id, 'base_qty', r.base_qty,
    'remarks', nullif(btrim(r.remarks), '')) order by r.uom_id)
  into v_rows from jsonb_to_recordset(p_payload->'conversions') r(uom_id bigint, base_qty numeric, remarks text);
  if v_rows is null or exists (
    select 1 from jsonb_to_recordset(v_rows) r(uom_id bigint, base_qty numeric)
    where r.uom_id is null or r.base_qty is null or r.base_qty <= 0
      or r.base_qty::text in ('NaN', 'Infinity', '-Infinity')
      or not exists (select 1 from public.uom_master_data u where u.id = r.uom_id and u.void = '1')
  ) then raise exception 'Each conversion requires an active UoM and a positive finite quantity'; end if;
  if exists (select 1 from jsonb_to_recordset(v_rows) r(uom_id bigint) group by r.uom_id having count(*) > 1) then
    raise exception 'A UoM can only appear once in a conversion group';
  end if;
  if not exists (select 1 from jsonb_to_recordset(v_rows) r(uom_id bigint, base_qty numeric) where r.uom_id = v_base and r.base_qty = 1)
     or not exists (select 1 from jsonb_to_recordset(v_rows) r(uom_id bigint) where r.uom_id = v_default) then
    raise exception 'Base UoM must have quantity 1 and Default UoM must belong to the group';
  end if;
  if v_id is not null then
    select * into v_group from public.uom_groups where id = v_id for update;
    if not found or v_group.void <> '1' then raise exception 'Active UoM group not found'; end if;
    select jsonb_agg(jsonb_build_object('uom_id', c.uom_id, 'base_qty', c.base_qty,
      'remarks', nullif(btrim(c.remarks), '')) order by c.uom_id)
    into v_existing from public.uom_group_conversions c where c.uom_group_id = v_id and c.void = '1';
    -- An identical save/retry performs no mutation and produces no second event.
    if v_group.code = upper(btrim(p_payload->>'code')) and v_group.name = btrim(p_payload->>'name')
      and v_group.base_uom_id = v_base and v_group.default_uom_id = v_default
      and v_group.remarks is not distinct from nullif(btrim(p_payload->>'remarks'), '')
      and v_existing = v_rows then return v_id; end if;
    update public.uom_groups set code = upper(btrim(p_payload->>'code')), name = btrim(p_payload->>'name'),
      base_uom_id = v_base, default_uom_id = v_default, remarks = nullif(btrim(p_payload->>'remarks'), ''),
      updated_by = v_actor, updated_at = v_now where id = v_id;
    if not found then raise exception 'UoM group update denied' using errcode = '42501'; end if;
    update public.uom_group_conversions set void = '0', updated_by = v_actor, updated_at = v_now
      where uom_group_id = v_id and void = '1';
  else
    insert into public.uom_groups(code, name, base_uom_id, default_uom_id, remarks, created_by, void, creation_request_id)
      values (upper(btrim(p_payload->>'code')), btrim(p_payload->>'name'), v_base, v_default,
        nullif(btrim(p_payload->>'remarks'), ''), v_actor, '1', v_request) returning id into v_id;
  end if;
  insert into public.uom_group_conversions(uom_group_id, uom_id, base_qty, remarks, created_by, updated_by, updated_at, void)
    select v_id, r.uom_id, r.base_qty, r.remarks, v_actor, v_actor, v_now, '1'
    from jsonb_to_recordset(v_rows) r(uom_id bigint, base_qty numeric, remarks text)
    on conflict (uom_group_id, uom_id) do update set base_qty = excluded.base_qty,
      remarks = excluded.remarks, updated_by = excluded.updated_by, updated_at = excluded.updated_at, void = '1';
  select jsonb_agg(jsonb_build_object('uom_id', c.uom_id, 'base_qty', c.base_qty,
    'remarks', nullif(btrim(c.remarks), '')) order by c.uom_id)
  into v_existing from public.uom_group_conversions c where c.uom_group_id = v_id and c.void = '1';
  if v_existing is distinct from v_rows then raise exception 'Conversion rows could not be saved completely'; end if;
  return v_id;
end;
$$;

create or replace function public.void_uom_group(p_id bigint)
returns void language plpgsql security invoker set search_path = public as $$
declare v_group public.uom_groups%rowtype; v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_group from public.uom_groups where id = p_id for update;
  if not found then raise exception 'UoM group not found'; end if;
  if v_group.void <> '1' then return; end if;
  update public.uom_group_conversions set void = '0', updated_by = v_actor, updated_at = clock_timestamp() where uom_group_id = p_id;
  if exists (select 1 from public.uom_group_conversions where uom_group_id = p_id and void = '1') then
    raise exception 'Conversion rows could not be voided completely';
  end if;
  update public.uom_groups set void = '0', updated_by = v_actor, updated_at = clock_timestamp() where id = p_id;
  if not found then raise exception 'UoM group void denied' using errcode = '42501'; end if;
end;
$$;

-- Deferred verification also guards direct writes. The base UoM remains the
-- legacy fallback for groups that previously had no explicit default.
create or replace function public.validate_uom_group_default()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_group public.uom_groups%rowtype;
begin
  if tg_table_name = 'uom_groups' then v_id := new.id;
  elsif tg_op = 'DELETE' then v_id := old.uom_group_id;
  else v_id := new.uom_group_id; end if;
  select * into v_group from public.uom_groups where id = v_id for update;
  if found and v_group.void = '1' and v_group.default_uom_id <> v_group.base_uom_id
    and not exists (select 1 from public.uom_group_conversions c
      where c.uom_group_id = v_id and c.uom_id = v_group.default_uom_id and c.void = '1' and c.base_qty > 0) then
    raise exception 'Default UoM must be an active conversion in this group';
  end if;
  return null;
end;
$$;
drop trigger if exists uom_groups_validate_default on public.uom_groups;
create constraint trigger uom_groups_validate_default after insert or update on public.uom_groups
  deferrable initially deferred for each row execute function public.validate_uom_group_default();
drop trigger if exists uom_conversions_validate_default on public.uom_group_conversions;
create constraint trigger uom_conversions_validate_default after insert or update or delete on public.uom_group_conversions
  deferrable initially deferred for each row execute function public.validate_uom_group_default();

-- One header mutation per RPC action; outbox and conversions share its transaction.
create or replace function public.enqueue_uom_group_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_event text; v_fms text; v_changed text[] := array[]::text[]; v_field text;
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then v_event := 'UOM_GROUP_POSTED';
  elsif old.void = '1' and new.void <> '1' then v_event := 'UOM_GROUP_VOIDED';
  elsif new.void = '1' then
    v_event := 'UOM_GROUP_EDITED';
    foreach v_field in array array['code','name','base_uom_id','default_uom_id','remarks'] loop
      if to_jsonb(old)->v_field is distinct from to_jsonb(new)->v_field then v_changed := array_append(v_changed, v_field); end if;
    end loop;
  else return new; end if;
  select case lower(btrim(u.fms_type)) when 'broiler' then 'Broiler' when 'breeder' then 'Breeder' when 'hatchery' then 'Hatchery' end
    into v_fms from public.users u where u.auth_id = auth.uid() limit 1;
  insert into public.notification_outbox(module_key, event_key, entity_type, entity_id, document_no,
    fms_type, farm_id, recipient_farm_id, actor_auth_id, target_url, permission_group, permission_title,
    title, message, priority, metadata, dedupe_key, occurred_at)
  values ('UOM_GROUP', v_event, 'uom_groups', new.id::text, new.code, v_fms, null, null, auth.uid(),
    '/a_dean/uom-conversions/edit/' || new.id::text, 'Menus', 'UoM Conversions/view',
    'UoM conversion group updated', 'UoM group {document_no} was updated by {initiator_name}.', 'normal',
    jsonb_build_object('changedFields', v_changed),
    v_event || ':' || new.id::text || case when v_event = 'UOM_GROUP_EDITED' then ':' || txid_current()::text else '' end, now())
  on conflict (dedupe_key) do nothing;
  return new;
end;
$$;
drop trigger if exists uom_groups_enqueue_event on public.uom_groups;
create trigger uom_groups_enqueue_event after insert or update on public.uom_groups
  for each row execute function public.enqueue_uom_group_event();

revoke all on function public.save_uom_group(bigint,jsonb), public.void_uom_group(bigint) from public, anon;
grant execute on function public.save_uom_group(bigint,jsonb), public.void_uom_group(bigint) to authenticated;
revoke all on function public.validate_uom_group_default(), public.enqueue_uom_group_event() from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
