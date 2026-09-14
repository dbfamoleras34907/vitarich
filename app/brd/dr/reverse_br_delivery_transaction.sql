-- Apply after save_br_delivery_transaction.sql and current notification_system.sql.
-- Deployment reverses no documents.
begin;
alter table public.br_delivery add column if not exists reversed_at timestamptz;
alter table public.br_delivery add column if not exists reversed_by uuid references auth.users(id);
alter table public.br_delivery add column if not exists reversal_reason text;
-- Separate from the Growing-specific reversal link and its validation trigger.
alter table public.inventory_postings add column if not exists delivery_reverses_posting_id bigint references public.inventory_postings(id);
create unique index if not exists inventory_postings_delivery_reversal_uidx
  on public.inventory_postings(delivery_reverses_posting_id) where delivery_reverses_posting_id is not null;

create or replace function public.validate_delivery_reversal_posting()
returns trigger language plpgsql set search_path = public as $$
declare original public.inventory_postings%rowtype;
begin
  if new.source_doc_type is distinct from 'BR_DELIVERY_REVERSAL' then
    if new.delivery_reverses_posting_id is not null then raise exception 'Only Harvest & Delivery reversals may use the harvest reversal link.'; end if;
    return new;
  end if;
  select * into original from public.inventory_postings where id = new.delivery_reverses_posting_id;
  if not found or original.source_doc_type not in ('BR_DELIVERY')
    or new.source_doc_type <> original.source_doc_type || '_REVERSAL'
    or new.source_docentry is distinct from original.source_docentry
    or new.item_code is distinct from original.item_code
    or new.warehouse_code is distinct from original.warehouse_code
    or new.batch_number is distinct from original.batch_number
    or new.qty is distinct from original.qty
    or new.ref is distinct from original.ref
    or original.transfer_type <> 'OUT' or new.transfer_type <> 'IN' then
    raise exception 'Harvest & Delivery reversal must exactly restore its linked original posting.';
  end if;
  return new;
end;
$$;
drop trigger if exists validate_delivery_reversal_posting on public.inventory_postings;
create trigger validate_delivery_reversal_posting before insert or update on public.inventory_postings
  for each row execute function public.validate_delivery_reversal_posting();


create or replace function public.reverse_br_delivery_transaction(p_delivery_id bigint, p_reason text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_header public.br_delivery%rowtype;
  v_card public.flock_card%rowtype;
  v_posting record;
  v_card_ids bigint[];
  v_super boolean;
begin
  if v_actor is null then raise exception 'Authentication is required.' using errcode = '42501'; end if;
  select u.user_type = 1 into v_super from public.users u
    where u.auth_id = v_actor and btrim(u.isactive::text) = '1';
  if v_super is null or (not v_super and not exists (
    select 1 from public.user_permissions p where p.user_id = v_actor
      and p.ilink = '/brd/dr/void' and p.is_visible
  )) then raise exception 'Harvest & Delivery Void permission is required.' using errcode = '42501'; end if;
  if p_reason is null or length(btrim(p_reason)) not between 1 and 1000 then
    raise exception 'A reversal reason of 1 to 1000 characters is required.';
  end if;
  select * into v_header from public.br_delivery where id = p_delivery_id;
  if not found then raise exception 'Harvest & Delivery document was not found.'; end if;
  if not exists (select 1 from public.farms where id = v_header.farm_id
    and upper(btrim(farm_type)) in ('BR', 'BROILER')) then
    raise exception 'Harvest & Delivery must reference a valid Broiler farm.';
  end if;
  if not v_super and not exists (
    select 1 from public.users u join public.users_farms uf on uf.users_id = u.id
    where u.auth_id = v_actor and upper(btrim(u.fms_type)) in ('BR', 'BROILER')
      and uf.farm_id = v_header.farm_id and uf.void = '1'
  ) then raise exception 'Access to the document farm is required.' using errcode = '42501'; end if;

  perform pg_advisory_xact_lock(hashtextextended('BRD_FC_FARM:' || v_header.farm_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('BR_DELIVERY_INVENTORY_POST', 0));
  lock table public.br_delivery, public.br_delivery_lines, public.br_cleanup,
    public.br_cleanup_lines, public.flock_card, public.flock_card_origin,
    public.brd_fc, public.brd_fc_line, public.goods_receipt_doc,
    public.doc_farm_cycles, public.inventory_postings in share row exclusive mode;
  select * into v_header from public.br_delivery where id = p_delivery_id for update;
  if v_header.status = 'Cancelled' and v_header.reversed_at is not null then
    return jsonb_build_object('id', p_delivery_id, 'reversed', true);
  end if;
  if v_header.status <> 'Posted' then raise exception 'Only posted Harvest & Delivery documents can be reversed.'; end if;
  if not exists (select 1 from public.inventory_postings p where p.source_doc_type = 'BR_DELIVERY'
    and p.source_docentry = p_delivery_id) then raise exception 'The original harvest inventory posting is missing.'; end if;

  for v_posting in select p.* from public.inventory_postings p
    where p.source_doc_type = 'BR_DELIVERY' and p.source_docentry = p_delivery_id order by p.id loop
    -- Recover the original cycle from its exact persisted batch/warehouse identity.
    -- Origin-less DOC Receiving uses the canonical numeric farm/building/cycle key.
    select array_agg(c.id) into v_card_ids from public.flock_card c
      where c.farm_id = v_header.farm_id and c.void = '1' and c.status in ('Saved','Closed')
        and upper(btrim(c.building_code)) = upper(btrim(v_posting.warehouse_code))
        and c.start_date::date <= v_header.issue_date
        and (upper(btrim(coalesce(v_posting.batch_number,v_posting.ref))) = upper(format('DOC:F%s:B%s:%s', c.farm_id,c.building_whse_id,btrim(c.cycle_no)))
          or (btrim(coalesce(v_posting.batch_number,v_posting.ref)) !~* '^DOC:F[0-9]+:B[0-9]+:.+$'
            and exists (select 1 from public.flock_card_origin o where o.fc_id=c.id and o.void='1'
            and upper(btrim(o.item_code))=upper(btrim(v_posting.item_code))
            and upper(btrim(o.batch_no))=upper(btrim(coalesce(v_posting.batch_number,v_posting.ref))))));
    if coalesce(cardinality(v_card_ids),0) <> 1 then
      raise exception 'Cannot uniquely identify the original harvest cycle for building %, batch %.',v_posting.warehouse_code,v_posting.batch_number;
    end if;
    select * into v_card from public.flock_card where id=v_card_ids[1];
    if exists (
      select 1 from public.br_cleanup h
      left join public.br_cleanup_lines l on l.br_cleanup_id=h.id and l.void='1'
      where h.farm_id=v_header.farm_id and h.status='Posted'
        and (
          (v_card.extra->>'closed_by_doc_type'='BR_CLEANUP' and v_card.extra->>'closed_by_docentry'=h.id::text)
          or ((coalesce(l.from_warehouse_id,h.from_warehouse_id)=v_card.building_whse_id
            or upper(btrim(coalesce(l.from_warehouse_code,h.from_warehouse_code)))=upper(btrim(v_card.building_code)))
            and (nullif(btrim(l.batch_number),'') is null
              or upper(btrim(l.batch_number))=upper(format('DOC:F%s:B%s:%s',v_card.farm_id,v_card.building_whse_id,btrim(v_card.cycle_no)))
              or (btrim(l.batch_number) !~* '^DOC:F[0-9]+:B[0-9]+:.+$'
                and exists(select 1 from public.flock_card_origin o where o.fc_id=v_card.id and o.void='1'
                and upper(btrim(o.batch_no))=upper(btrim(l.batch_number)) and upper(btrim(o.item_code))=upper(btrim(l.item_code))))))
        )
    ) then raise exception 'Posted Clean Up exists for building %. Reverse that cleanup first.',v_card.building_code; end if;
    if v_card.status <> 'Saved' or exists (
      select 1 from public.flock_card newer where newer.farm_id=v_card.farm_id
        and newer.building_whse_id=v_card.building_whse_id and newer.void='1'
        and newer.status <> 'Cancelled' and newer.id <> v_card.id
        and (newer.id>v_card.id or newer.start_date>v_card.start_date)
    ) then raise exception 'Only harvests in the current active cycle can be reversed for building %.',v_card.building_code; end if;
  end loop;

  insert into public.inventory_postings(source_doc_type,source_docentry,item_code,warehouse_code,
    bin_code,qty,created_by,ref_type,ref,batch_number,transfer_type,ref_type2,ref2,delivery_reverses_posting_id)
  select 'BR_DELIVERY_REVERSAL',p_delivery_id,p.item_code,p.warehouse_code,p.bin_code,p.qty,v_actor,
    p.ref_type,p.ref,p.batch_number,'IN',p.ref_type2,p.ref2,p.id
  from public.inventory_postings p where p.source_doc_type='BR_DELIVERY' and p.source_docentry=p_delivery_id;
  update public.br_delivery set status='Cancelled',reversed_at=now(),reversed_by=v_actor,
    reversal_reason=btrim(p_reason),updated_at=now(),updated_by=v_actor,
    notification_revision=notification_revision+1 where id=p_delivery_id;
  return jsonb_build_object('id',p_delivery_id,'reversed',true);
end;
$$;
revoke all on function public.reverse_br_delivery_transaction(bigint,text) from public,anon;
grant execute on function public.reverse_br_delivery_transaction(bigint,text) to authenticated;

-- Extend the existing enqueue and shared dispatcher without replacing unrelated modules.
do $patch$
declare definition text;
begin
  select pg_get_functiondef('public.enqueue_br_delivery_event()'::regprocedure) into definition;
  definition := replace(definition, 'case when new.status = ''Posted'' then ''BR_DELIVERY_POSTED'' else ''BR_DELIVERY_EDITED'' end',
    'case when new.status = ''Cancelled'' and new.reversed_at is not null then ''BR_DELIVERY_VOIDED'' when new.status = ''Posted'' then ''BR_DELIVERY_POSTED'' else ''BR_DELIVERY_EDITED'' end');
  definition := replace(definition, 'case when new.status = ''Posted'' then ''Harvest & Delivery posted'' else ''Harvest & Delivery edited'' end',
    'case when new.status = ''Cancelled'' then ''Harvest & Delivery reversed'' when new.status = ''Posted'' then ''Harvest & Delivery posted'' else ''Harvest & Delivery edited'' end');
  if position('BR_DELIVERY_VOIDED' in definition) = 0 then raise exception 'Harvest event hook patch did not match.'; end if;
  execute definition;
  select pg_get_functiondef('public.process_notification_outbox(integer)'::regprocedure) into definition;
  definition := replace(definition, '(''BR_DELIVERY_POSTED'', ''BR_DELIVERY_EDITED'')', '(''BR_DELIVERY_POSTED'', ''BR_DELIVERY_EDITED'', ''BR_DELIVERY_VOIDED'')');
  if position('v_event.event_key <> ''BR_DELIVERY_VOIDED''' in definition) = 0 then
    definition := replace(definition, 'and (v_event.event_key <> ''BR_DELIVERY_POSTED'' or delivery.status = ''Posted'')',
      'and (v_event.event_key <> ''BR_DELIVERY_POSTED'' or delivery.status = ''Posted'')
            and (v_event.event_key <> ''BR_DELIVERY_VOIDED'' or (delivery.status = ''Cancelled'' and delivery.reversed_at is not null))');
  end if;
  if position('v_event.event_key <> ''BR_DELIVERY_VOIDED''' in definition) = 0 then raise exception 'Harvest dispatcher patch did not match.'; end if;
  execute definition;
end;
$patch$;
notify pgrst, 'reload schema';
commit;
