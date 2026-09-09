begin;

alter table public.br_cleanup_lines
  add column if not exists batch_total_qty numeric(18, 6) not null default 0,
  add column if not exists variance_qty numeric(18, 6) not null default 0;

alter table public.br_cleanup_lines
  drop constraint if exists br_cleanup_lines_qty_check;

alter table public.br_cleanup_lines
  add constraint br_cleanup_lines_qty_check check (
    alt_qty >= 1
    and base_qty > 0
    and batch_total_qty >= 0
    and variance_qty >= 0
  );

do $migration$
declare
  v_function_sql text;
  v_original_sql text;
  v_quantity_rule_replaced boolean := false;
begin
  select pg_get_functiondef('public.post_br_cleanup_inventory()'::regprocedure)
  into v_function_sql;

  v_original_sql := v_function_sql;
  v_function_sql := replace(
    v_function_sql,
    $old$where greatest(coalesce(expected.qty, 0), coalesce(issued.required_qty, 0)) > 0
      and abs(coalesce(expected.qty, 0) - coalesce(issued.required_qty, 0)) > 0.000001$old$,
    $new$where coalesce(issued.required_qty, 0) > coalesce(expected.qty, 0) + 0.000001$new$
  );
  v_quantity_rule_replaced := v_function_sql is distinct from v_original_sql;
  v_function_sql := replace(
    v_function_sql,
    'Broiler clean-up quantity exceeds on-hand inventory.',
    'Clean up quantity exceeds the live placement-batch balance.'
  );
  v_function_sql := replace(
    v_function_sql,
    'Clean up must issue the full live placement-batch balance for every selected building.',
    'Clean up quantity exceeds the live placement-batch balance.'
  );

  if not v_quantity_rule_replaced
    and position('where coalesce(issued.required_qty, 0) > coalesce(expected.qty, 0) + 0.000001' in v_function_sql) = 0 then
    raise exception 'The existing post_br_cleanup_inventory function does not match the expected full-balance version. Apply br_cleanup_tables.sql instead.';
  end if;

  execute v_function_sql;
end;
$migration$;

create or replace function public.post_br_cleanup_variance_inventory()
returns trigger
language plpgsql
as $$
begin
  if new.status <> 'Posted' then return new; end if;

  if exists (
    select 1 from public.inventory_postings posting
    where posting.source_doc_type = 'BR_CLEANUP_VARIANCE'
      and posting.source_docentry = new.id
  ) then return new; end if;

  insert into public.inventory_postings (
    source_doc_type, source_docentry, item_code, warehouse_code, bin_code,
    qty, created_by, ref_type, ref, batch_number, transfer_type, ref_type2, ref2
  )
  with closed_cycles as (
    select distinct card.id as flock_card_id, line.from_warehouse_code as warehouse_code
    from public.br_cleanup_lines line
    join public.flock_card card
      on card.farm_id = new.farm_id
     and card.void = '1'
     and card.status = 'Closed'
     and card.extra->>'closed_by_doc_type' = 'BR_CLEANUP'
     and nullif(card.extra->>'closed_by_docentry', '')::bigint = new.id
     and (
       (line.from_warehouse_id is not null and card.building_whse_id = line.from_warehouse_id)
       or card.building_code = line.from_warehouse_code
     )
    where line.br_cleanup_id = new.id and line.void = '1'
  ), expected_batches as (
    select distinct origin.item_code, cycle.warehouse_code, origin.batch_no as batch_number
    from closed_cycles cycle
    join public.flock_card_origin origin on origin.fc_id = cycle.flock_card_id and origin.void = '1'
  ), on_hand as (
    select posting.item_code, posting.warehouse_code,
      coalesce(posting.batch_number, posting.ref) as batch_number,
      sum(case when posting.transfer_type = 'OUT' then -posting.qty else posting.qty end) as qty
    from public.inventory_postings posting
    group by posting.item_code, posting.warehouse_code, coalesce(posting.batch_number, posting.ref)
  )
  select 'BR_CLEANUP_VARIANCE', new.id, expected.item_code, expected.warehouse_code,
    'MAIN SUB BIN', stock.qty, coalesce(new.updated_by, new.created_by),
    'batch_code', expected.batch_number, expected.batch_number, 'OUT', 'BR_CLEANUP', new.gi_no
  from expected_batches expected
  join on_hand stock
    on stock.item_code = expected.item_code
   and stock.warehouse_code = expected.warehouse_code
   and stock.batch_number is not distinct from expected.batch_number
  where stock.qty > 0.000001;

  return new;
end;
$$;

drop trigger if exists zz_post_br_cleanup_variance_inventory_trigger on public.br_cleanup;
create trigger zz_post_br_cleanup_variance_inventory_trigger
after update of status on public.br_cleanup
for each row
when (new.status = 'Posted' and old.status is distinct from 'Posted')
execute function public.post_br_cleanup_variance_inventory();

commit;
