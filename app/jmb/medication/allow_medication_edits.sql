begin;

-- Allow corrections while a medication record is Posted. Cancelled records
-- remain immutable, and cancellation may only change audit/status fields.
create or replace function public.guard_brd_medication_update()
returns trigger language plpgsql as $$
begin
  if old.status = 'Cancelled' then
    raise exception 'Cancelled medication records are immutable';
  end if;

  if new.status = 'Cancelled' then
    if (to_jsonb(new) - array['status','updated_by','updated_at','cancelled_by','cancelled_at','cancellation_reason'])
       is distinct from
       (to_jsonb(old) - array['status','updated_by','updated_at','cancelled_by','cancelled_at','cancellation_reason']) then
      raise exception 'Medication details cannot be changed during cancellation';
    end if;
  elsif new.status <> 'Posted' then
    raise exception 'Invalid medication status transition';
  elsif new.document_no is distinct from old.document_no
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
     or new.cancelled_by is distinct from old.cancelled_by
     or new.cancelled_at is distinct from old.cancelled_at
     or new.cancellation_reason is distinct from old.cancellation_reason then
    raise exception 'Medication audit fields cannot be edited';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_brd_medication_update_trigger on public.tbl_brd_medication;
create trigger guard_brd_medication_update_trigger
before update on public.tbl_brd_medication
for each row execute function public.guard_brd_medication_update();

-- Target pens may be corrected only while their parent record is Posted.
create or replace function public.guard_brd_medication_target_change()
returns trigger language plpgsql as $$
declare parent_status text;
begin
  if tg_op = 'DELETE' then
    select status into parent_status
    from public.tbl_brd_medication
    where id = old.medication_id;

    if parent_status <> 'Posted' then
      raise exception 'Cancelled medication targets are immutable';
    end if;
    return old;
  end if;

  select status into parent_status
  from public.tbl_brd_medication
  where id = new.medication_id;

  if parent_status <> 'Posted' then
    raise exception 'Cancelled medication targets are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_brd_medication_target_change_trigger on public.tbl_brd_medication_target;
create trigger guard_brd_medication_target_change_trigger
before insert or update or delete on public.tbl_brd_medication_target
for each row execute function public.guard_brd_medication_target_change();

commit;
