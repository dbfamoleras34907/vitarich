-- Apply after the current notification_system.sql, doc_farm_cycles.sql,
-- and deploy_harvest_emptied_cleanup.sql. Deployment reverses no documents.
begin;
alter table public.br_cleanup add column if not exists reversed_at timestamptz;
alter table public.br_cleanup add column if not exists reversed_by uuid references auth.users(id);
alter table public.br_cleanup add column if not exists reversal_reason text;
-- Separate from the Growing-specific reversal link and its validation trigger.
alter table public.inventory_postings add column if not exists cleanup_reverses_posting_id bigint references public.inventory_postings(id);
create unique index if not exists inventory_postings_cleanup_reversal_uidx
  on public.inventory_postings(cleanup_reverses_posting_id) where cleanup_reverses_posting_id is not null;

create or replace function public.validate_cleanup_reversal_posting()
returns trigger language plpgsql set search_path = public as $$
declare original public.inventory_postings%rowtype;
begin
  if new.source_doc_type not in ('BR_CLEANUP_REVERSAL', 'BR_CLEANUP_VARIANCE_REVERSAL') then
    if new.cleanup_reverses_posting_id is not null then raise exception 'Only Clean Up reversals may use the cleanup reversal link.'; end if;
    return new;
  end if;
  select * into original from public.inventory_postings where id = new.cleanup_reverses_posting_id;
  if not found or original.source_doc_type not in ('BR_CLEANUP', 'BR_CLEANUP_VARIANCE')
    or new.source_doc_type <> original.source_doc_type || '_REVERSAL'
    or new.source_docentry is distinct from original.source_docentry
    or new.item_code is distinct from original.item_code
    or new.warehouse_code is distinct from original.warehouse_code
    or new.batch_number is distinct from original.batch_number
    or new.qty is distinct from original.qty
    or new.ref is distinct from original.ref
    or original.transfer_type <> 'OUT' or new.transfer_type <> 'IN' then
    raise exception 'Clean Up reversal must exactly restore its linked original posting.';
  end if;
  return new;
end;
$$;
drop trigger if exists validate_cleanup_reversal_posting on public.inventory_postings;
create trigger validate_cleanup_reversal_posting before insert or update on public.inventory_postings
  for each row execute function public.validate_cleanup_reversal_posting();

create or replace function public.reverse_br_cleanup_transaction(p_cleanup_id bigint, p_reason text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_header public.br_cleanup%rowtype;
  v_card public.flock_card%rowtype;
  v_closed_at timestamptz;
  v_cards bigint[];
  v_super boolean;
begin
  if v_actor is null then raise exception 'Authentication is required.' using errcode = '42501'; end if;
  select u.user_type = 1 into v_super from public.users u
    where u.auth_id = v_actor and btrim(u.isactive::text) = '1';
  if v_super is null or (not v_super and not exists (
    select 1 from public.user_permissions p where p.user_id = v_actor
      and p.ilink = '/brd/cu/void' and p.is_visible
  )) then raise exception 'Clean Up Void permission is required.' using errcode = '42501'; end if;
  if p_reason is null or length(btrim(p_reason)) not between 1 and 1000 then
    raise exception 'A reversal reason of 1 to 1000 characters is required.';
  end if;
  select * into v_header from public.br_cleanup where id = p_cleanup_id;
  if not found then raise exception 'Clean Up document was not found.'; end if;
  if not exists (select 1 from public.farms where id = v_header.farm_id
    and upper(btrim(farm_type)) in ('BR', 'BROILER')) then
    raise exception 'Clean Up must reference a valid Broiler farm.';
  end if;
  if not v_super and not exists (
    select 1 from public.users u join public.users_farms uf on uf.users_id = u.id
    where u.auth_id = v_actor and upper(btrim(u.fms_type)) in ('BR', 'BROILER')
      and uf.farm_id = v_header.farm_id and uf.void = '1'
  ) then raise exception 'Access to the document farm is required.' using errcode = '42501'; end if;

  -- Serialize with Growing and Harvest; block legacy writers during dependency checks.
  perform pg_advisory_xact_lock(hashtextextended('BRD_FC_FARM:' || v_header.farm_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('BR_DELIVERY_INVENTORY_POST', 0));
  lock table public.br_delivery, public.br_delivery_lines, public.br_cleanup,
    public.br_cleanup_lines, public.flock_card, public.flock_card_origin,
    public.brd_fc, public.brd_fc_line, public.goods_receipt_doc,
    public.doc_farm_cycles, public.inventory_postings in share row exclusive mode;
  select * into v_header from public.br_cleanup where id = p_cleanup_id for update;
  if v_header.status = 'Cancelled' and v_header.reversed_at is not null then
    return jsonb_build_object('id', p_cleanup_id, 'reversed', true);
  end if;
  if v_header.status <> 'Posted' then raise exception 'Only posted Clean Up documents can be reversed.'; end if;

  select array_agg(c.id) into v_cards from public.flock_card c
    where c.farm_id = v_header.farm_id and c.void = '1' and c.status = 'Closed'
      and c.extra->>'closed_by_doc_type' = 'BR_CLEANUP'
      and c.extra->>'closed_by_docentry' = p_cleanup_id::text;
  if v_cards is null or exists (
    select 1 from public.br_cleanup_lines l where l.br_cleanup_id = p_cleanup_id and l.void = '1'
      and not exists (select 1 from public.flock_card c where c.id = any(v_cards)
        and c.building_whse_id = l.from_warehouse_id and c.building_code = l.from_warehouse_code)
  ) then raise exception 'The original closed cycles no longer match this Clean Up.'; end if;

  for v_card in select * from public.flock_card where id = any(v_cards) loop
    v_closed_at := nullif(v_card.extra->>'closed_at', '')::timestamptz;
    if v_closed_at is null then raise exception 'Cycle closeout timestamp is missing; reversal requires review.'; end if;
    if exists (select 1 from public.flock_card newer
      where newer.farm_id = v_card.farm_id and newer.building_whse_id = v_card.building_whse_id
        and newer.id <> v_card.id and newer.void = '1' and newer.status <> 'Cancelled'
        and (newer.id > v_card.id or newer.start_date > v_card.start_date)) then
      raise exception 'A newer cycle exists for building %.', v_card.building_code;
    end if;
    if v_card.farm_cycle_id is not null and (
      not exists (select 1 from public.doc_farm_cycles f where f.id = v_card.farm_cycle_id
        and f.farm_id = v_header.farm_id and f.status in ('Saved', 'Closed'))
      or exists (select 1 from public.doc_farm_cycles newer join public.doc_farm_cycles original
        on original.id = v_card.farm_cycle_id where newer.farm_id = original.farm_id
        and newer.id <> original.id and newer.status <> 'Cancelled'
        and (newer.cycle_no > original.cycle_no or newer.status = 'Saved'))
    ) then raise exception 'The farm cycle cannot be reopened because a newer cycle exists or the original is inactive.'; end if;

    if exists (select 1 from public.inventory_postings p
      where upper(btrim(p.warehouse_code)) = upper(btrim(v_card.building_code))
        and p.id > coalesce((select max(original.id) from public.inventory_postings original
          where original.source_docentry = p_cleanup_id
            and original.source_doc_type in ('BR_CLEANUP', 'BR_CLEANUP_VARIANCE')
            and upper(btrim(original.warehouse_code)) = upper(btrim(v_card.building_code))), 0)
    ) or exists (
      select 1 from public.br_delivery h left join public.br_delivery_lines l on l.br_delivery_id = h.id and l.void = '1'
      where h.farm_id = v_header.farm_id and h.status <> 'Cancelled'
        and (coalesce(l.from_warehouse_id, h.from_warehouse_id) = v_card.building_whse_id or coalesce(l.from_warehouse_code, h.from_warehouse_code) = v_card.building_code)
        and greatest(h.created_at, h.updated_at, l.created_at, l.updated_at) > v_closed_at
    ) or exists (
      select 1 from public.br_cleanup h left join public.br_cleanup_lines l on l.br_cleanup_id = h.id and l.void = '1'
      where h.farm_id = v_header.farm_id and h.id <> p_cleanup_id and h.status <> 'Cancelled'
        and (coalesce(l.from_warehouse_id, h.from_warehouse_id) = v_card.building_whse_id or coalesce(l.from_warehouse_code, h.from_warehouse_code) = v_card.building_code)
        and greatest(h.created_at, h.updated_at, l.created_at, l.updated_at) > v_closed_at
    ) or exists (
      select 1 from public.brd_fc h left join public.brd_fc_line l on l.fc_id = h.id and l.void = '1'
      where h.farm_id = v_header.farm_id and h.void = '1'
        and (h.building_whse_id = v_card.building_whse_id or h.card_no = v_card.card_no)
        and greatest(h.created_at, h.updated_at, l.created_at, l.updated_at) > v_closed_at
    ) or exists (
      select 1 from public.goods_receipt_doc d where d.void = '1'
        and (d.flock_card_id = v_card.id or d.building_warehouse_id = v_card.building_whse_id)
        and greatest(d.created_at, d.updated_at) > v_closed_at
    ) then raise exception 'A subsequent transaction exists for building %.', v_card.building_code; end if;
  end loop;

  if not exists (select 1 from public.inventory_postings where source_docentry = p_cleanup_id
    and source_doc_type = 'BR_CLEANUP') then raise exception 'The original cleanup inventory posting is missing.'; end if;
  insert into public.inventory_postings(source_doc_type, source_docentry, item_code, warehouse_code,
    bin_code, qty, created_by, ref_type, ref, batch_number, transfer_type, ref_type2, ref2, cleanup_reverses_posting_id)
  select case when p.source_doc_type = 'BR_CLEANUP' then 'BR_CLEANUP_REVERSAL' else 'BR_CLEANUP_VARIANCE_REVERSAL' end,
    p_cleanup_id, p.item_code, p.warehouse_code, p.bin_code, p.qty, v_actor,
    p.ref_type, p.ref, p.batch_number, case when p.transfer_type = 'OUT' then 'IN' else 'OUT' end,
    p.ref_type2, p.ref2, p.id
  from public.inventory_postings p where p.source_docentry = p_cleanup_id
    and p.source_doc_type in ('BR_CLEANUP', 'BR_CLEANUP_VARIANCE');

  update public.flock_card set status = 'Saved', updated_by = v_actor, updated_at = now(),
    extra = (extra - 'closed_by_doc_type' - 'closed_by_docentry' - 'closed_by_doc_no' - 'closed_at')
      || jsonb_build_object('reopened_by_cleanup_id', p_cleanup_id, 'reopened_at', now())
    where id = any(v_cards);
  update public.doc_farm_cycles set status = 'Saved', closed_at = null, updated_by = v_actor, updated_at = now()
    where id in (select farm_cycle_id from public.flock_card where id = any(v_cards)) and status = 'Closed';
  -- The existing transactional enqueue trigger publishes one VOIDED event.
  update public.br_cleanup set status = 'Cancelled', reversed_at = now(), reversed_by = v_actor,
    reversal_reason = btrim(p_reason), updated_at = now(), updated_by = v_actor,
    notification_revision = notification_revision + 1 where id = p_cleanup_id;
  return jsonb_build_object('id', p_cleanup_id, 'reversed', true);
end;
$$;
revoke all on function public.reverse_br_cleanup_transaction(bigint, text) from public, anon;
grant execute on function public.reverse_br_cleanup_transaction(bigint, text) to authenticated;

-- Extend the existing enqueue and shared dispatcher without replacing unrelated modules.
do $patch$
declare definition text;
begin
  select pg_get_functiondef('public.enqueue_br_cleanup_event()'::regprocedure) into definition;
  definition := replace(definition, 'case when new.status = ''Posted'' then ''BR_CLEANUP_POSTED'' else ''BR_CLEANUP_EDITED'' end',
    'case when new.status = ''Cancelled'' and new.reversed_at is not null then ''BR_CLEANUP_VOIDED'' when new.status = ''Posted'' then ''BR_CLEANUP_POSTED'' else ''BR_CLEANUP_EDITED'' end');
  definition := replace(definition, 'case when new.status = ''Posted'' then ''Clean Up posted'' else ''Clean Up edited'' end',
    'case when new.status = ''Cancelled'' then ''Clean Up reversed'' when new.status = ''Posted'' then ''Clean Up posted'' else ''Clean Up edited'' end');
  if position('BR_CLEANUP_VOIDED' in definition) = 0 then raise exception 'Cleanup event hook patch did not match.'; end if;
  execute definition;
  select pg_get_functiondef('public.process_notification_outbox(integer)'::regprocedure) into definition;
  definition := replace(definition, '(''BR_CLEANUP_POSTED'', ''BR_CLEANUP_EDITED'')', '(''BR_CLEANUP_POSTED'', ''BR_CLEANUP_EDITED'', ''BR_CLEANUP_VOIDED'')');
  if position('v_event.event_key <> ''BR_CLEANUP_VOIDED''' in definition) = 0 then
    definition := replace(definition, 'and (v_event.event_key <> ''BR_CLEANUP_POSTED'' or delivery.status = ''Posted'')',
      'and (v_event.event_key <> ''BR_CLEANUP_POSTED'' or delivery.status = ''Posted'')
            and (v_event.event_key <> ''BR_CLEANUP_VOIDED'' or (delivery.status = ''Cancelled'' and delivery.reversed_at is not null))');
  end if;
  if position('v_event.event_key <> ''BR_CLEANUP_VOIDED''' in definition) = 0 then raise exception 'Cleanup dispatcher patch did not match.'; end if;
  execute definition;
end;
$patch$;
notify pgrst, 'reload schema';
commit;
