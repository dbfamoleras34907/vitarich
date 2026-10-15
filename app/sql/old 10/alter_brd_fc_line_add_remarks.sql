-- Adds per-age mortality remarks and general remarks to Broiler Growing.
-- Apply after the current flock_card_tables.sql and save_brd_fc_transaction.sql.
begin;

alter table public.brd_fc_line
  add column if not exists mortality_remarks text null,
  add column if not exists remarks text null;

create or replace function public.validate_brd_fc_mortality_remarks()
returns trigger
language plpgsql
as $$
begin
  -- Preserve legacy rows that predate remarks, but enforce the rule whenever
  -- mortality or its remarks are newly inserted or materially changed.
  if tg_op = 'INSERT' then
    if coalesce(new.mort_am, 0) + coalesce(new.mort_pm, 0) <> 0
       and nullif(btrim(new.mortality_remarks), '') is null then
      raise exception 'Mortality remarks are required when mortality is not zero.';
    end if;
  else
    if (new.mort_am is distinct from old.mort_am
        or new.mort_pm is distinct from old.mort_pm
        or new.mortality_remarks is distinct from old.mortality_remarks)
       and coalesce(new.mort_am, 0) + coalesce(new.mort_pm, 0) <> 0
       and nullif(btrim(new.mortality_remarks), '') is null then
      raise exception 'Mortality remarks are required when mortality is not zero.';
    end if;

    if coalesce(old.mort_am, 0) + coalesce(old.mort_pm, 0) <> 0
       and coalesce(new.mort_am, 0) + coalesce(new.mort_pm, 0) = 0 then
      new.mortality_remarks := null;
    end if;
  end if;

  new.mortality_remarks := nullif(btrim(new.mortality_remarks), '');
  new.remarks := nullif(btrim(new.remarks), '');
  return new;
end;
$$;

drop trigger if exists validate_brd_fc_mortality_remarks_on_line on public.brd_fc_line;
create trigger validate_brd_fc_mortality_remarks_on_line
before insert or update on public.brd_fc_line
for each row execute function public.validate_brd_fc_mortality_remarks();

create or replace function public.save_brd_fc_transaction(p_request_id uuid, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_hash text := md5(p_payload::text);
  v_request public.brd_fc_save_requests%rowtype;
  v_header public.brd_fc%rowtype;
  v_line public.brd_fc_line%rowtype;
  v_saved_line public.brd_fc_line%rowtype;
  v_farm public.farms%rowtype;
  v_input jsonb;
  v_feed jsonb;
  v_result jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_id bigint := nullif(p_payload->>'id', '')::bigint;
begin
  if v_user is null or p_request_id is null then
    raise exception 'A signed-in user and save request ID are required.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into v_request from public.brd_fc_save_requests where request_id = p_request_id;
  if found then
    if v_request.actor_auth_id <> v_user or v_request.payload_hash <> v_hash then
      raise exception 'Save request ID was already used for a different action.';
    end if;
    return v_request.result;
  end if;
  if jsonb_typeof(p_payload->'lines') is distinct from 'array' then
    raise exception 'Growing lines must be an array.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_payload->'lines') x
    group by (x->>'age')::integer having count(*) > 1
  ) then
    raise exception 'Growing cannot contain duplicate ages.';
  end if;

  select * into v_farm from public.farms
  where id = (p_payload->'header'->>'farm_id')::bigint;
  if not found or coalesce(upper(btrim(v_farm.farm_type)), '') not in ('BR', 'BROILER') then
    raise exception 'A valid Broiler farm is required.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('BRD_FC_FARM:' || v_farm.id::text, 0));
  if v_id is not null then
    select * into v_header from public.brd_fc where id = v_id and void = '1' for update;
    if not found then raise exception 'Growing record was not found or cannot be edited.'; end if;
    if v_header.farm_id is distinct from v_farm.id then
      raise exception 'The saved Growing farm cannot be changed.';
    end if;
  end if;
  v_header := jsonb_populate_record(v_header, p_payload->'header');
  v_header.farm_id := v_farm.id;
  v_header.farm_code := v_farm.code;
  v_header.farm_name := v_farm.name;
  if not exists (
    select 1
    from public.flock_card placement
    left join public.doc_farm_cycles cycle on cycle.id = placement.farm_cycle_id
    where placement.card_no = v_header.card_no
      and placement.farm_id = v_header.farm_id
      and placement.void = '1' and placement.status = 'Saved'
      and (placement.farm_cycle_id is null or cycle.status in ('Saved', 'Past Open'))
  ) then
    raise exception 'Growing requires a Current Cycle or Past Open Cycle.';
  end if;
  if v_id is null then
    insert into public.brd_fc (fc_no, card_no, fc_date, farm_id, farm_code, farm_name, building_id, building_whse_id, building_src, building_key, building_code, building_name, building_status, feed_whse_id, feed_whse_code, feed_whse_name, animal_qty, created_by, updated_by, void)
    values (v_header.fc_no, v_header.card_no, v_header.fc_date, v_header.farm_id, v_header.farm_code, v_header.farm_name, v_header.building_id, v_header.building_whse_id, v_header.building_src, v_header.building_key, v_header.building_code, v_header.building_name, v_header.building_status, v_header.feed_whse_id, v_header.feed_whse_code, v_header.feed_whse_name, v_header.animal_qty, v_user, v_user, '1')
    returning * into v_header;
  else
    update public.brd_fc set
      fc_no = v_header.fc_no,
      card_no = v_header.card_no,
      fc_date = v_header.fc_date,
      farm_id = v_header.farm_id,
      farm_code = v_header.farm_code,
      farm_name = v_header.farm_name,
      building_id = v_header.building_id,
      building_whse_id = v_header.building_whse_id,
      building_src = v_header.building_src,
      building_key = v_header.building_key,
      building_code = v_header.building_code,
      building_name = v_header.building_name,
      building_status = v_header.building_status,
      feed_whse_id = v_header.feed_whse_id,
      feed_whse_code = v_header.feed_whse_code,
      feed_whse_name = v_header.feed_whse_name,
      animal_qty = v_header.animal_qty,
      updated_by = v_user
    where id = v_id and void = '1' returning * into v_header;
    if not found then raise exception 'Growing header could not be updated.'; end if;
  end if;

  for v_input in select value from jsonb_array_elements(p_payload->'lines') order by (value->>'age')::integer
  loop
    begin
      select * into v_saved_line from public.brd_fc_line
      where fc_id = v_header.id and age = (v_input->>'age')::integer and void = '1'
      for update;
      if found then
        v_line := jsonb_populate_record(v_saved_line, v_input->'update');
        update public.brd_fc_line set
          mort_am = v_line.mort_am,
          mort_pm = v_line.mort_pm,
          mort_total = v_line.mort_total,
          thin_am = v_line.thin_am,
          thin_pm = v_line.thin_pm,
          row_total = v_line.row_total,
          cum_total = v_line.cum_total,
          mortality_remarks = v_line.mortality_remarks,
          feed_kg = v_line.feed_kg,
          feed_bird = v_line.feed_bird,
          feed_guideline = v_line.feed_guideline,
          feed_batch_text = v_line.feed_batch_text,
          water_l = v_line.water_l,
          water_bird = v_line.water_bird,
          body_wt = v_line.body_wt,
          body_guideline = v_line.body_guideline,
          temp_min = v_line.temp_min,
          temp_max = v_line.temp_max,
          hum_min = v_line.hum_min,
          hum_max = v_line.hum_max,
          nh3_max = v_line.nh3_max,
          skin_b = v_line.skin_b,
          skin_a = v_line.skin_a,
          skin_l = v_line.skin_l,
          remarks = v_line.remarks,
          extra = v_line.extra,
          is_locked = v_line.is_locked,
          updated_by = v_user
        where id = v_saved_line.id and void = '1' returning * into v_saved_line;
        if not found then raise exception 'Growing line could not be updated.'; end if;
      else
        v_line := jsonb_populate_record(null::public.brd_fc_line, v_input->'insert');
        insert into public.brd_fc_line (fc_id, age, mort_am, mort_pm, mort_total, thin_am, thin_pm, row_total, cum_total, mortality_remarks, feed_kg, feed_bird, feed_guideline, feed_batch_text, water_l, water_bird, body_wt, body_guideline, temp_min, temp_max, hum_min, hum_max, nh3_max, skin_b, skin_a, skin_l, remarks, extra, is_locked, created_by, updated_by, void)
        values (v_header.id, (v_input->>'age')::integer, v_line.mort_am, v_line.mort_pm, v_line.mort_total, v_line.thin_am, v_line.thin_pm, v_line.row_total, v_line.cum_total, v_line.mortality_remarks, v_line.feed_kg, v_line.feed_bird, v_line.feed_guideline, v_line.feed_batch_text, v_line.water_l, v_line.water_bird, v_line.body_wt, v_line.body_guideline, v_line.temp_min, v_line.temp_max, v_line.hum_min, v_line.hum_max, v_line.nh3_max, v_line.skin_b, v_line.skin_a, v_line.skin_l, v_line.remarks, v_line.extra, v_line.is_locked, v_user, v_user, '1')
        returning * into v_saved_line;
      end if;
      v_feed := nullif(v_input->'feed', 'null'::jsonb);
      if v_feed is not null then
        perform public.save_brd_fc_feed_intake(
          v_saved_line.id,
          (v_feed->>'p_feed_kg')::numeric,
          (v_feed->>'p_feed_bird')::numeric,
          (v_feed->>'p_feed_guideline')::numeric,
          v_feed->>'p_feed_batch_text',
          (v_feed->>'p_feed_type_id')::bigint,
          v_feed->'p_allocations'
        );
      end if;
      v_lines := v_lines || jsonb_build_array(jsonb_build_object('id', v_saved_line.id, 'age', v_saved_line.age));
    exception when others then
      raise exception using message = format('Age %s: %s', v_input->>'age', sqlerrm), errcode = sqlstate;
    end;
  end loop;
  v_result := jsonb_build_object('id', v_header.id, 'fcNo', v_header.fc_no, 'savedLines', v_lines);
  insert into public.brd_fc_save_requests(request_id, actor_auth_id, payload_hash, fc_id, is_new, result)
  values (p_request_id, v_user, v_hash, v_header.id, v_id is null, v_result);
  return v_result;
end;
$$;

revoke all on function public.save_brd_fc_transaction(uuid, jsonb) from public;
grant execute on function public.save_brd_fc_transaction(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
