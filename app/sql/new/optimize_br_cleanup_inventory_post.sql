-- Scope Clean Up's live-balance validation to the document's batch keys.
-- The previous trigger aggregated the complete inventory ledger on every Post,
-- which exceeded the Data API statement timeout as the ledger grew.

begin;

create index if not exists inventory_postings_cleanup_batch_lookup_idx
  on public.inventory_postings (
    upper(btrim(item_code)),
    upper(btrim(warehouse_code)),
    upper(btrim(coalesce(batch_number, ref))),
    id desc
  )
  include (source_doc_type, source_docentry, transfer_type, qty);

do $patch$
declare
  v_definition text;
  v_original text;
begin
  select pg_get_functiondef('public.post_br_cleanup_inventory()'::regprocedure)
  into v_definition;

  v_definition := replace(v_definition, chr(13), '');
  v_original := v_definition;

  v_definition := replace(
    v_definition,
    $old$    ), on_hand as (
      select
        btrim(posting.item_code) as item_code,
        btrim(posting.warehouse_code) as warehouse_code,
        btrim(coalesce(posting.batch_number, posting.ref)) as batch_number,
        sum(case when posting.transfer_type = 'OUT' then -posting.qty else posting.qty end) as qty
      from public.inventory_postings posting
      group by
        btrim(posting.item_code),
        btrim(posting.warehouse_code),
        btrim(coalesce(posting.batch_number, posting.ref))
    ), expected_qty as (
      select expected.item_code, expected.warehouse_code, expected.batch_number, coalesce(stock.qty, 0) as qty
      from allowed_batches expected
      left join on_hand stock
        on upper(stock.item_code) = upper(expected.item_code)
       and upper(stock.warehouse_code) = upper(expected.warehouse_code)
       and upper(stock.batch_number) is not distinct from upper(expected.batch_number)
    )$old$,
    $new$    ), expected_qty as (
      select
        expected.item_code,
        expected.warehouse_code,
        expected.batch_number,
        coalesce((
          select sum(
            case when posting.transfer_type = 'OUT' then -posting.qty else posting.qty end
          )
          from public.inventory_postings posting
          where upper(btrim(posting.item_code)) = upper(expected.item_code)
            and upper(btrim(posting.warehouse_code)) = upper(expected.warehouse_code)
            and upper(btrim(coalesce(posting.batch_number, posting.ref)))
              is not distinct from upper(expected.batch_number)
        ), 0) as qty
      from allowed_batches expected
    )$new$
  );

  if v_definition = v_original then
    if position('from allowed_batches expected' in v_definition) > 0
       and position('from public.inventory_postings posting' in v_definition) > 0
       and position('), on_hand as (' in v_definition) = 0 then
      return;
    end if;

    raise exception 'The deployed post_br_cleanup_inventory function does not match the expected version; no changes applied.';
  end if;

  if position('), on_hand as (' in v_definition) > 0
     or position('upper(btrim(posting.item_code)) = upper(expected.item_code)' in v_definition) = 0 then
    raise exception 'Clean Up inventory optimization did not match completely; no changes applied.';
  end if;

  execute v_definition;
end;
$patch$;

commit;
