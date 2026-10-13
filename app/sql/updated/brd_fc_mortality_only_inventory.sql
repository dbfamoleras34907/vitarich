-- Allows authoritative import workflows to record thinning while deducting
-- only mortality from DOC placement inventory. Apply before the Broiler DTW SQL.
begin;
set local lock_timeout = '15s';

create or replace function public.get_brd_fc_mort_thin_inventory_discrepancies()
returns table (
  line_id bigint,
  growing_id bigint,
  farm_id bigint,
  card_no text,
  age integer,
  expected_quantity numeric,
  inventory_quantity numeric,
  difference numeric
)
language sql
stable
as $$
  with reconciliation as (
    select
      line.id as line_id,
      line.fc_id as growing_id,
      card.farm_id,
      card.card_no::text,
      line.age,
      case when line.void = '1' then
        coalesce(line.mort_am, 0)
          + coalesce(line.mort_pm, 0)
          + case when coalesce((line.extra->>'dtwMortalityOnlyInventory')::boolean, false)
            then 0
            else coalesce(line.thin_am, 0) + coalesce(line.thin_pm, 0)
          end
      else 0 end::numeric as expected_quantity,
      -coalesce(sum(
        case when posting.transfer_type = 'IN' then posting.qty else -posting.qty end
      ), 0)::numeric as inventory_quantity
    from public.brd_fc_line line
    join public.brd_fc card on card.id = line.fc_id
    left join public.i_warehouse warehouse on warehouse.id = card.building_whse_id
    left join public.inventory_postings posting
      on posting.source_doc_type in (
        'BRD_FC_MORT_THIN_USAGE',
        'BRD_FC_MORT_THIN_TRANSFER_OUT',
        'BRD_FC_MORT_THIN_REVERSAL'
      )
     and (
       posting.source_docentry = line.id
       or posting.source_docentry between line.id * 1000000 and line.id * 1000000 + 999999
     )
     and posting.warehouse_code = nullif(btrim(coalesce(card.building_code, warehouse.whse_code, '')), '')
    group by line.id, line.fc_id, card.farm_id, card.card_no, line.age, line.void,
      line.mort_am, line.mort_pm, line.thin_am, line.thin_pm, line.extra
  )
  select
    reconciliation.line_id,
    reconciliation.growing_id,
    reconciliation.farm_id,
    reconciliation.card_no,
    reconciliation.age,
    reconciliation.expected_quantity,
    reconciliation.inventory_quantity,
    reconciliation.expected_quantity - reconciliation.inventory_quantity
  from reconciliation
  where abs(reconciliation.expected_quantity - reconciliation.inventory_quantity) > 0.000001
  order by reconciliation.farm_id, reconciliation.card_no, reconciliation.age;
$$;

create or replace function public.assert_brd_fc_mort_thin_inventory_balance(p_line_id bigint)
returns void
language plpgsql
as $$
declare
  v_line public.brd_fc_line%rowtype;
  v_source_whse_code text;
  v_expected numeric := 0;
  v_inventory_net numeric := 0;
begin
  if current_setting('app.broiler_dtw_legacy_allow_mort_thin_imbalance', true) = 'on' then
    return;
  end if;

  select * into v_line
  from public.brd_fc_line line
  where line.id = p_line_id;

  if not found then
    raise exception 'Growing mortality/thinning balance check could not find line %.', p_line_id;
  end if;

  select nullif(btrim(coalesce(card.building_code, warehouse.whse_code, '')), '')
  into v_source_whse_code
  from public.brd_fc card
  left join public.i_warehouse warehouse on warehouse.id = card.building_whse_id
  where card.id = v_line.fc_id;

  if v_source_whse_code is null then
    raise exception 'Growing mortality/thinning balance check requires a source warehouse for line %.', p_line_id;
  end if;

  if v_line.void = '1' then
    v_expected := coalesce(v_line.mort_am, 0)
      + coalesce(v_line.mort_pm, 0)
      + case when coalesce((v_line.extra->>'dtwMortalityOnlyInventory')::boolean, false)
        then 0
        else coalesce(v_line.thin_am, 0) + coalesce(v_line.thin_pm, 0)
      end;
  end if;

  select coalesce(sum(
    case when posting.transfer_type = 'IN' then posting.qty else -posting.qty end
  ), 0)
  into v_inventory_net
  from public.inventory_postings posting
  where posting.source_doc_type in (
      'BRD_FC_MORT_THIN_USAGE',
      'BRD_FC_MORT_THIN_TRANSFER_OUT',
      'BRD_FC_MORT_THIN_REVERSAL'
    )
    and (
      posting.source_docentry = p_line_id
      or posting.source_docentry between p_line_id * 1000000 and p_line_id * 1000000 + 999999
    )
    and posting.warehouse_code = v_source_whse_code;

  if abs(v_inventory_net + v_expected) > 0.000001 then
    raise exception
      'Growing mortality/thinning inventory is out of balance for line %: persisted quantity %, inventory quantity %.',
      p_line_id,
      v_expected,
      -v_inventory_net;
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
