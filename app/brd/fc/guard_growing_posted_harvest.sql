-- Apply after the Growing and Harvest schemas/save RPCs. No business data changes.
begin;

-- Invoker rights preserve RLS for the screen. The write trigger calls this with
-- its own database authority so hidden Harvest rows cannot bypass the guard.
create or replace function public.get_brd_fc_posted_harvest(p_farm_id bigint, p_card_no text)
returns text language sql security invoker set search_path = public
as $$
  select h.gi_no
  from public.flock_card c
  join public.br_delivery h on h.farm_id = c.farm_id and h.status = 'Posted'
  join public.br_delivery_lines l on l.br_delivery_id = h.id and l.void = '1'
  where c.farm_id = p_farm_id and c.card_no = p_card_no and c.void = '1'
    and (case when coalesce(l.from_warehouse_id,h.from_warehouse_id) is not null
      then coalesce(l.from_warehouse_id,h.from_warehouse_id) = c.building_whse_id
      else upper(btrim(coalesce(l.from_warehouse_code,h.from_warehouse_code))) = upper(btrim(c.building_code)) end)
    and (upper(btrim(l.batch_number)) = upper(format('DOC:F%s:B%s:%s',c.farm_id,c.building_whse_id,btrim(c.cycle_no)))
      or (btrim(l.batch_number) !~* '^DOC:F[0-9]+:B[0-9]+:.+$'
        and exists (select 1 from public.flock_card_origin o where o.fc_id=c.id and o.void='1'
          and upper(btrim(o.batch_no))=upper(btrim(l.batch_number))
          and upper(btrim(o.item_code))=upper(btrim(l.item_code)))))
  order by h.id limit 1
$$;
revoke all on function public.get_brd_fc_posted_harvest(bigint,text) from public;
grant execute on function public.get_brd_fc_posted_harvest(bigint,text) to authenticated;

create or replace function public.guard_growing_posted_harvest()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_row jsonb;
  v_header public.brd_fc%rowtype;
  v_blocker text;
begin
  -- Shared with Harvest posting: check only after any in-flight post settles.
  perform pg_advisory_xact_lock(hashtextextended('BR_DELIVERY_INVENTORY_POST',0));
  -- Check both identities so an UPDATE cannot escape by moving to another card.
  for v_row in select value from jsonb_array_elements(
    case tg_op when 'INSERT' then jsonb_build_array(to_jsonb(new))
      when 'DELETE' then jsonb_build_array(to_jsonb(old))
      else jsonb_build_array(to_jsonb(old),to_jsonb(new)) end)
  loop
    if tg_table_name = 'brd_fc' then
      v_header := jsonb_populate_record(null::public.brd_fc,v_row);
    elsif tg_table_name = 'brd_fc_line' then
      select * into v_header from public.brd_fc where id=(v_row->>'fc_id')::bigint;
    else
      select h.* into v_header from public.brd_fc h join public.brd_fc_line l on l.fc_id=h.id
        where l.id=(v_row->>'fc_line_id')::bigint;
    end if;
    v_blocker := public.get_brd_fc_posted_harvest(v_header.farm_id,v_header.card_no);
    if v_blocker is not null then
      raise exception 'Growing cannot be changed: Harvest & Delivery % is Posted for this building and cycle. Reverse all posted harvests in this cycle first.',v_blocker;
    end if;
  end loop;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.guard_growing_posted_harvest() from public;

drop trigger if exists guard_growing_posted_harvest on public.brd_fc;
create trigger guard_growing_posted_harvest before insert or update or delete on public.brd_fc
  for each row execute function public.guard_growing_posted_harvest();
drop trigger if exists guard_growing_posted_harvest on public.brd_fc_line;
create trigger guard_growing_posted_harvest before insert or update or delete on public.brd_fc_line
  for each row execute function public.guard_growing_posted_harvest();
drop trigger if exists guard_growing_posted_harvest on public.brd_fc_ba;
create trigger guard_growing_posted_harvest before insert or update or delete on public.brd_fc_ba
  for each row execute function public.guard_growing_posted_harvest();

-- Also serialize direct Harvest status changes with Growing writes.
create or replace function public.lock_harvest_growing_writes()
returns trigger language plpgsql set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('BR_DELIVERY_INVENTORY_POST',0));
  return new;
end;
$$;
drop trigger if exists lock_harvest_growing_writes on public.br_delivery;
create trigger lock_harvest_growing_writes before insert or update of status on public.br_delivery
  for each row execute function public.lock_harvest_growing_writes();
notify pgrst, 'reload schema';
commit;
