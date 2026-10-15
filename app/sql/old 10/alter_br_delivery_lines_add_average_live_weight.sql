-- Persist the editable ALW g snapshot used by Harvest & Delivery.
-- Apply app/sql/new/alter_growing_harvest_age.sql first, then this file,
-- then app/sql/updated/save_br_delivery_transaction.sql.
begin;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'br_delivery_lines'
      and column_name = 'harvest_age'
  ) then
    raise exception 'Missing public.br_delivery_lines.harvest_age. Apply app/sql/new/alter_growing_harvest_age.sql first.';
  end if;
end;
$$;

alter table public.br_delivery_lines
  add column if not exists average_live_weight numeric null;

alter table public.br_delivery_lines
  drop constraint if exists br_delivery_lines_average_live_weight_check;

alter table public.br_delivery_lines
  add constraint br_delivery_lines_average_live_weight_check
  check (
    average_live_weight is null
    or (average_live_weight >= 0 and average_live_weight < 'Infinity'::numeric)
  );

-- Backfill the exact Growing body weight recorded for the saved harvest age.
-- The latest saved Flock Card for the document cycle/building is authoritative.
with body_weight_matches as (
  select
    line.id as line_id,
    growing_line.body_wt,
    row_number() over (
      partition by line.id
      order by card.id desc, growing.id desc, growing_line.id desc
    ) as match_order
  from public.br_delivery_lines line
  join public.br_delivery delivery
    on delivery.id = line.br_delivery_id
  join public.flock_card card
    on card.farm_id = delivery.farm_id
   and card.farm_cycle_id = delivery.farm_cycle_id
   and card.void = '1'
   and card.status in ('Saved', 'Closed')
   and (
     card.building_whse_id = line.from_warehouse_id
     or upper(btrim(card.building_code)) = upper(btrim(line.from_warehouse_code))
   )
  join public.brd_fc growing
    on growing.card_no = card.card_no
   and growing.void = '1'
   and growing.status = 'Saved'
  join public.brd_fc_line growing_line
    on growing_line.fc_id = growing.id
   and growing_line.void = '1'
   and growing_line.age = line.harvest_age
   and growing_line.body_wt is not null
   and growing_line.body_wt > 0
  where line.average_live_weight is null
)
update public.br_delivery_lines line
set average_live_weight = match.body_wt
from body_weight_matches match
where match.line_id = line.id
  and match.match_order = 1;

notify pgrst, 'reload schema';

commit;
