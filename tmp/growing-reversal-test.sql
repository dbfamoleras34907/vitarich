create or replace function public.reverse_brd_fc_feed_intake(
  p_line_id bigint,
  p_reason text default null
)
returns table (id bigint, age integer)
language plpgsql
as $$
declare
  v_line record;
  v_card record;
  v_allocation record;
  v_user uuid;
begin
  v_user := auth.uid();

  select *
  into v_line
  from public.brd_fc_line line
  where line.id = p_line_id
    and line.void = '1'
  for update;

  if not found then
    raise exception 'Unable to reverse feed intake: flock card line % was not found', p_line_id;
  end if;

  select *
  into v_card
  from public.brd_fc card
  where card.id = v_line.fc_id
    and card.void = '1';

  if not found then
    raise exception 'Unable to reverse feed intake: flock card % was not found', v_line.fc_id;
  end if;

  v_user := coalesce(v_user, v_line.updated_by, v_line.created_by, v_card.updated_by, v_card.created_by);

  if v_user is null then
    raise exception 'Unable to reverse feed intake: user is required';
  end if;

  for v_allocation in
    select *
    from public.brd_fc_ba
    where fc_line_id = p_line_id
      and void = '1'
    order by line_no
    for update
  loop
    if coalesce(v_allocation.alloc_qty, 0) > 0
      and not exists (
        select 1
        from public.inventory_postings ip
        where ip.source_doc_type = 'BRD_FC_FEED_REVERSAL'
          and ip.source_docentry = v_allocation.id
      ) then
      insert into public.inventory_postings (
        source_doc_type,
        source_docentry,
        item_code,
        warehouse_code,
        bin_code,
        qty,
        created_by,
        ref_type,
        ref,
        transfer_type,
        ref_type2,
        ref2
      )
      values (
        'BRD_FC_FEED_REVERSAL',
        v_allocation.id,
        v_allocation.item_code,
        v_allocation.whse_code,
        'MAIN SUB BIN',
        v_allocation.alloc_qty,
        v_user,
        'batch_code',
        v_allocation.batch_no,
        'IN',
        'FLOCK_CARD',
        v_card.fc_no
      );
    end if;

    update public.brd_fc_ba
    set
      void = '0',
      updated_by = v_user,
      reversed_by = v_user,
      reversed_at = coalesce(reversed_at, now()),
      reversal_reason = coalesce(nullif(btrim(p_reason), ''), reversal_reason, 'Reverse feed intake')
    where public.brd_fc_ba.id = v_allocation.id;
  end loop;

  return query
  update public.brd_fc_line line
  set
    feed_kg = null,
    feed_bird = null,
    feed_guideline = null,
    feed_batch_text = null,
    extra = coalesce(line.extra, '{}'::jsonb) - 'feedTypeId',
    is_locked = false,
    updated_by = v_user,
    reversed_by = v_user,
    reversed_at = coalesce(line.reversed_at, now()),
    reversal_reason = coalesce(nullif(btrim(p_reason), ''), line.reversal_reason, 'Reverse feed intake')
  where line.id = p_line_id
    and line.void = '1'
  returning line.id, line.age;
end;
$$;
do $$declare n bigint; l bigint; begin
 select min(id) into l from brd_fc_line;
 select count(*) into n from notification_outbox;
 perform reverse_brd_fc_feed_intake(l,'Test reversal');
 if (select count(*) from notification_outbox) <> n+1 then raise exception 'Missing reversal edit event'; end if;
 perform reverse_brd_fc_feed_intake(l,'Test repeated reversal');
 if (select count(*) from notification_outbox) <> n+1 then raise exception 'Repeated reversal duplicated event'; end if;
 raise notice 'PASS: actual feed reversal emits once; repeated reversal emits no additional event';
end;$$;
