-- Deploy after app/admin/notifications/notification_system.sql.
-- This migration deliberately does not mutate existing Egg Laying rows.
begin;

alter table public.tbl_egglaying
  add column if not exists void_reason text,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid,
  add column if not exists notification_revision bigint not null default 0,
  add column if not exists notification_event_key text;

do $$
begin
  alter table public.tbl_egglaying
    add constraint tbl_egglaying_farm_id_required
    check (farm_id is not null) not valid;
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.tbl_egglaying
    add constraint tbl_egglaying_farm_id_fkey
    foreign key (farm_id) references public.farms(id) not valid;
exception when duplicate_object then null;
end;
$$;

create or replace function public.assert_breeder_egg_laying_access(
  p_action text,
  p_farm_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_user_id bigint;
  v_is_super_admin boolean := false;
begin
  if v_actor is null then
    raise exception 'An authenticated user is required.';
  end if;
  if p_action not in ('insert', 'edit', 'void') then
    raise exception 'Invalid Egg Laying action.';
  end if;

  select user_row.id, coalesce(user_row.user_type, 3) = 1
  into v_user_id, v_is_super_admin
  from public.users user_row
  where user_row.auth_id = v_actor
    and user_row.fms_type = 'Breeder';

  if not found then
    raise exception 'Only Breeder users can manage Egg Laying.';
  end if;

  if not v_is_super_admin and not exists (
    select 1
    from public.user_permissions permission_row
    where permission_row.user_id = v_actor
      and permission_row.group_name = 'Breeder Masters'
      and permission_row.title = 'Laying Production/' || p_action
      and permission_row.is_visible = true
  ) then
    raise exception 'You do not have permission to % Egg Laying.', p_action;
  end if;

  if not v_is_super_admin and not exists (
    select 1
    from public.users_farms assignment
    where assignment.users_id = v_user_id
      and assignment.farm_id = p_farm_id
      and btrim(coalesce(assignment.void::text, '0')) = '1'
  ) then
    raise exception 'You are not assigned to this Breeder farm.';
  end if;
end;
$$;

create or replace function public.assert_egg_laying_dispatch_allocation(
  p_egg_laying_id bigint,
  p_hatching_egg numeric,
  p_classb numeric,
  p_junior numeric,
  p_table_egg numeric,
  p_jumbo numeric,
  p_crack numeric,
  p_condemn numeric,
  p_for_void boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line record;
  v_available numeric;
begin
  for v_line in
    select line.category, sum(coalesce(line.dispatch_qty, 0)) as allocated
    from public.tbl_brd_dispatch_line line
    join public.tbl_brd_dispatch header on header.id = line.dispatch_id
    where header.status = 'Posted'
      and line.source_type = 'Egg Laying'
      and line.source_record_id = p_egg_laying_id
    group by line.category
  loop
    if p_for_void then
      raise exception 'Egg Laying cannot be voided because a Posted Breeder Dispatch uses this record.';
    end if;
    v_available := case v_line.category
      when 'hatching_egg' then p_hatching_egg
      when 'classb' then p_classb
      when 'junior' then p_junior
      when 'table_egg' then p_table_egg
      when 'jumbo' then p_jumbo
      when 'crack' then p_crack
      when 'condemn' then p_condemn
      else null
    end;
    if v_available is null or v_available < v_line.allocated then
      raise exception 'Egg Laying % cannot be reduced below its Posted Breeder Dispatch allocation for %.', p_egg_laying_id, v_line.category;
    end if;
  end loop;
end;
$$;

create or replace function public.save_breeder_egg_layings(p_rows jsonb)
returns setof public.tbl_egglaying
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_input jsonb;
  v_id bigint;
  v_date date;
  v_placement_id bigint;
  v_farm record;
  v_placement record;
  v_existing public.tbl_egglaying%rowtype;
  v_saved public.tbl_egglaying%rowtype;
  v_tep numeric;
  v_hatching numeric;
  v_classb numeric;
  v_junior numeric;
  v_dirty numeric;
  v_misshapen numeric;
  v_off_size numeric;
  v_thin_shell numeric;
  v_jumbo numeric;
  v_crack numeric;
  v_condemn numeric;
  v_total numeric;
  v_action text;
begin
  if v_actor is null then raise exception 'An authenticated user is required.'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Add at least one Egg Laying row.';
  end if;

  for v_input in select value from jsonb_array_elements(p_rows)
  loop
    v_id := nullif(v_input->>'id', '')::bigint;
    v_date := nullif(v_input->>'date_laying', '')::date;
    v_placement_id := nullif(v_input->>'placement_id', '')::bigint;
    if v_date is null or v_date > current_date then raise exception 'Date Laying must not be blank or in the future.'; end if;
    if v_placement_id is null then raise exception 'Placement is required.'; end if;

    select placement.farm_id, placement.building_id, placement.building_no, placement.placement_date, placement.age_anchor_date
    into v_placement
    from public.tbl_placement placement
    where placement.id = v_placement_id;
    if not found or v_placement.farm_id is null then raise exception 'Egg Laying requires a placement with an assigned farm.'; end if;

    select farm.id, farm.code, farm.name, farm.farm_type
    into v_farm
    from public.farms farm
    where farm.id = v_placement.farm_id
      and upper(btrim(coalesce(farm.farm_type, ''))) in ('BE', 'BREEDER');
    if not found then raise exception 'Egg Laying requires an active Breeder farm.'; end if;

    v_action := case when v_id is null then 'insert' else 'edit' end;
    perform public.assert_breeder_egg_laying_access(v_action, v_farm.id);
    perform pg_advisory_xact_lock(hashtextextended(
      'EGG_LAYING:' || v_farm.id || ':' || coalesce(v_placement.building_id, 0) || ':' || v_date,
      0
    ));

    v_tep := coalesce((v_input->>'tep_collection')::numeric, 0);
    v_hatching := coalesce((v_input->>'hatching_egg')::numeric, 0);
    v_classb := coalesce((v_input->>'classb')::numeric, 0);
    v_junior := coalesce((v_input->>'junior')::numeric, 0);
    v_dirty := coalesce((v_input->>'table_egg_dirty')::numeric, 0);
    v_misshapen := coalesce((v_input->>'table_egg_misshapen')::numeric, 0);
    v_off_size := coalesce((v_input->>'table_egg_off_size')::numeric, 0);
    v_thin_shell := coalesce((v_input->>'table_egg_thin_shell')::numeric, 0);
    v_jumbo := coalesce((v_input->>'jumbo')::numeric, 0);
    v_crack := coalesce((v_input->>'crack')::numeric, 0);
    v_condemn := coalesce((v_input->>'condemn')::numeric, 0);
    if least(v_tep, v_hatching, v_classb, v_junior, v_dirty, v_misshapen, v_off_size, v_thin_shell, v_jumbo, v_crack, v_condemn) < 0
       or v_tep <> trunc(v_tep) or v_hatching <> trunc(v_hatching) or v_classb <> trunc(v_classb)
       or v_junior <> trunc(v_junior) or v_dirty <> trunc(v_dirty) or v_misshapen <> trunc(v_misshapen)
       or v_off_size <> trunc(v_off_size) or v_thin_shell <> trunc(v_thin_shell) or v_jumbo <> trunc(v_jumbo)
       or v_crack <> trunc(v_crack) or v_condemn <> trunc(v_condemn) then
      raise exception 'Egg Laying quantities must be non-negative whole numbers.';
    end if;
    v_total := v_hatching + v_classb + v_junior + v_dirty + v_misshapen + v_off_size + v_thin_shell + v_jumbo + v_crack + v_condemn;
    if v_tep <= 0 or v_tep <> v_total then raise exception 'TEP Collection must equal Total Egg Classification.'; end if;

    if exists (
      select 1 from public.tbl_egglaying duplicate_row
      where duplicate_row.is_active = true
        and duplicate_row.farm_id = v_farm.id
        and duplicate_row.building_id is not distinct from v_placement.building_id
        and duplicate_row.date_laying = v_date
        and duplicate_row.id is distinct from v_id
    ) then raise exception 'Date Laying already has a saved active record for this building.'; end if;

    if v_id is null then
      insert into public.tbl_egglaying (
        placement_id, date_laying, farm_id, farm_name, building_id, building, age,
        tep_collection, hatching_egg, classb, junior, table_egg_dirty, table_egg_misshapen,
        table_egg_off_size, table_egg_thin_shell, jumbo, crack, condemn, is_active, created_by,
        notification_revision, notification_event_key
      ) values (
        v_placement_id, v_date, v_farm.id, v_farm.name, v_placement.building_id, v_placement.building_no,
        greatest(0, v_date - coalesce(v_placement.age_anchor_date, v_placement.placement_date) + 1), v_tep, v_hatching, v_classb, v_junior,
        v_dirty, v_misshapen, v_off_size, v_thin_shell, v_jumbo, v_crack, v_condemn, true, v_actor,
        1, 'EGG_LAYING_POSTED'
      ) returning * into v_saved;
    else
      select * into v_existing from public.tbl_egglaying where id = v_id for update;
      if not found or not v_existing.is_active then raise exception 'Egg Laying record is not active.'; end if;
      if v_existing.farm_id is distinct from v_farm.id or v_existing.placement_id is distinct from v_placement_id then
        raise exception 'A saved Egg Laying record cannot be moved to another placement or farm.';
      end if;
      perform public.assert_egg_laying_dispatch_allocation(
        v_id, v_hatching, v_classb, v_junior, v_dirty + v_misshapen + v_off_size + v_thin_shell,
        v_jumbo, v_crack, v_condemn
      );
      update public.tbl_egglaying set
        date_laying = v_date, farm_name = v_farm.name, building_id = v_placement.building_id,
        building = v_placement.building_no, age = greatest(0, v_date - coalesce(v_placement.age_anchor_date, v_placement.placement_date) + 1),
        tep_collection = v_tep, hatching_egg = v_hatching, classb = v_classb, junior = v_junior,
        table_egg_dirty = v_dirty, table_egg_misshapen = v_misshapen, table_egg_off_size = v_off_size,
        table_egg_thin_shell = v_thin_shell, jumbo = v_jumbo, crack = v_crack, condemn = v_condemn,
        updated_at = now(), updated_by = v_actor, notification_revision = notification_revision + 1,
        notification_event_key = 'EGG_LAYING_EDITED'
      where id = v_id returning * into v_saved;
    end if;
    return next v_saved;
  end loop;
end;
$$;

create or replace function public.void_breeder_egg_laying(p_id bigint, p_reason text)
returns public.tbl_egglaying
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_saved public.tbl_egglaying%rowtype;
begin
  if v_actor is null then raise exception 'An authenticated user is required.'; end if;
  if nullif(btrim(p_reason), '') is null then raise exception 'Void reason is required.'; end if;
  select * into v_saved from public.tbl_egglaying where id = p_id for update;
  if not found then raise exception 'Egg Laying record was not found.'; end if;
  perform public.assert_breeder_egg_laying_access('void', v_saved.farm_id);
  if not v_saved.is_active then return v_saved; end if;
  perform public.assert_egg_laying_dispatch_allocation(
    v_saved.id, 0, 0, 0, 0, 0, 0, 0, true
  );
  update public.tbl_egglaying set
    is_active = false, void_reason = btrim(p_reason), voided_at = now(), voided_by = v_actor,
    updated_at = now(), updated_by = v_actor, notification_revision = notification_revision + 1,
    notification_event_key = 'EGG_LAYING_VOIDED'
  where id = p_id returning * into v_saved;
  return v_saved;
end;
$$;

revoke all on function public.assert_breeder_egg_laying_access(text, bigint) from public, anon, authenticated;
revoke all on function public.assert_egg_laying_dispatch_allocation(bigint, numeric, numeric, numeric, numeric, numeric, numeric, numeric, boolean) from public, anon, authenticated;
revoke all on function public.save_breeder_egg_layings(jsonb) from public, anon;
revoke all on function public.void_breeder_egg_laying(bigint, text) from public, anon;
grant execute on function public.save_breeder_egg_layings(jsonb) to authenticated;
grant execute on function public.void_breeder_egg_laying(bigint, text) to authenticated;

create or replace function public.enqueue_egg_laying_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.notification_event_key not in ('EGG_LAYING_POSTED', 'EGG_LAYING_EDITED', 'EGG_LAYING_VOIDED') then
    raise exception 'Invalid Egg Laying notification event.';
  end if;
  insert into public.notification_outbox (
    module_key, event_key, entity_type, entity_id, document_no, fms_type,
    farm_id, recipient_farm_id, actor_auth_id, target_url, permission_group,
    permission_title, title, message, priority, metadata, dedupe_key, occurred_at
  ) values (
    'EGG_LAYING', new.notification_event_key, 'tbl_egglaying', new.id::text,
    new.date_laying::text, 'Breeder', new.farm_id, new.farm_id, auth.uid(),
    '/jmb/egglaying/new?id=' || new.id, 'Breeder Masters', 'Laying Production/view',
    case new.notification_event_key when 'EGG_LAYING_POSTED' then 'Egg Laying posted'
      when 'EGG_LAYING_EDITED' then 'Egg Laying edited' else 'Egg Laying voided' end,
    'Egg Laying {document_no} was updated by {initiator_name}.', 'normal',
    jsonb_build_object('revision', new.notification_revision, 'buildingId', new.building_id),
    new.notification_event_key || ':' || new.id || ':' || new.notification_revision, now()
  ) on conflict (dedupe_key) do nothing;
  return new;
end;
$$;

revoke all on function public.enqueue_egg_laying_event() from public, anon, authenticated;
drop trigger if exists tbl_egglaying_enqueue_event on public.tbl_egglaying;
drop trigger if exists tbl_egglaying_enqueue_insert_event on public.tbl_egglaying;
create trigger tbl_egglaying_enqueue_insert_event
after insert on public.tbl_egglaying
for each row when (new.notification_revision > 0)
execute function public.enqueue_egg_laying_event();
create trigger tbl_egglaying_enqueue_event
after update of notification_revision on public.tbl_egglaying
for each row when (new.notification_revision > old.notification_revision)
execute function public.enqueue_egg_laying_event();

-- Add a persisted-source/farm check to the centralized dispatcher.  The
-- migration stops rather than silently allowing an unverified farm event.
do $patch$
declare v_definition text;
begin
  select pg_get_functiondef('public.process_notification_outbox(integer)'::regprocedure) into v_definition;
  if position('EGG_LAYING' in v_definition) = 0 then
    if position('      elsif v_event.module_key = ''BR_DELIVERY''' in v_definition) = 0 then
      raise exception 'Apply the current notification_system.sql before this migration.';
    end if;
    v_definition := replace(v_definition, '      elsif v_event.module_key = ''BR_DELIVERY''',
      $branch$      elsif v_event.module_key = 'EGG_LAYING'
            and v_event.event_key in ('EGG_LAYING_POSTED', 'EGG_LAYING_EDITED', 'EGG_LAYING_VOIDED') then
        select exists (
          select 1
          from public.tbl_egglaying egg
          join public.farms farm on farm.id = egg.farm_id
          where egg.id::text = v_event.entity_id
            and egg.farm_id = v_event.farm_id
            and egg.farm_id = v_event.recipient_farm_id
            and egg.notification_revision = coalesce((v_event.metadata->>'revision')::bigint, -1)
            and v_event.entity_type = 'tbl_egglaying'
            and v_event.fms_type = 'Breeder'
            and upper(btrim(farm.farm_type)) in ('BE', 'BREEDER')
            and ((v_event.event_key = 'EGG_LAYING_VOIDED' and egg.is_active = false)
              or (v_event.event_key <> 'EGG_LAYING_VOIDED' and egg.is_active = true))
        ) into v_source_valid;
        if not coalesce(v_source_valid, false) then
          update public.notification_outbox
          set status = 'invalid', processed_at = now(), processing_started_at = null,
              last_error = 'Egg Laying event does not match its persisted farm or lifecycle state.'
          where id = v_event.id;
          continue;
        end if;
      elsif v_event.module_key = 'BR_DELIVERY'$branch$);
    execute v_definition;
  end if;
end;
$patch$;

notify pgrst, 'reload schema';
commit;
