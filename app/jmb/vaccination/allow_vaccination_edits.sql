begin;

-- Allow corrections while a vaccination is Posted. Cancelled records remain
-- immutable, and cancellation itself may only change audit/status fields.
create or replace function public.guard_brd_vaccination_update()
returns trigger language plpgsql as $$
begin
  if old.status = 'Cancelled' then
    raise exception 'Cancelled vaccination records are immutable';
  end if;

  if new.status = 'Cancelled' then
    if (to_jsonb(new) - array['status','updated_by','updated_at','cancelled_by','cancelled_at','cancellation_reason'])
       is distinct from
       (to_jsonb(old) - array['status','updated_by','updated_at','cancelled_by','cancelled_at','cancellation_reason']) then
      raise exception 'Vaccination details cannot be changed during cancellation';
    end if;
  elsif new.status <> 'Posted' then
    raise exception 'Invalid vaccination status transition';
  elsif new.document_no is distinct from old.document_no
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
     or new.cancelled_by is distinct from old.cancelled_by
     or new.cancelled_at is distinct from old.cancelled_at
     or new.cancellation_reason is distinct from old.cancellation_reason then
    raise exception 'Vaccination audit fields cannot be edited';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_brd_vaccination_update_trigger on public.tbl_brd_vaccination;
create trigger guard_brd_vaccination_update_trigger
before update on public.tbl_brd_vaccination
for each row execute function public.guard_brd_vaccination_update();

-- Target pens may be corrected only while their parent record is Posted.
create or replace function public.guard_brd_vaccination_target_change()
returns trigger language plpgsql as $$
declare parent_status text;
begin
  if tg_op = 'DELETE' then
    select status into parent_status
    from public.tbl_brd_vaccination
    where id = old.vaccination_id;

    if parent_status <> 'Posted' then
      raise exception 'Cancelled vaccination targets are immutable';
    end if;
    return old;
  end if;

  select status into parent_status
  from public.tbl_brd_vaccination
  where id = new.vaccination_id;

  if parent_status <> 'Posted' then
    raise exception 'Cancelled vaccination targets are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_brd_vaccination_target_change_trigger on public.tbl_brd_vaccination_target;
create trigger guard_brd_vaccination_target_change_trigger
before insert or update or delete on public.tbl_brd_vaccination_target
for each row execute function public.guard_brd_vaccination_target_change();

commit;
