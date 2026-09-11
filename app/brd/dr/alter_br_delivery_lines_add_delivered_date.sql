-- Apply before the updated save_br_delivery_transaction.sql and delivery UI.
begin;
alter table public.br_delivery_lines add column if not exists delivered_date date;
update public.br_delivery_lines line
set delivered_date = delivery.issue_date
from public.br_delivery delivery
where delivery.id = line.br_delivery_id and line.delivered_date is null;
alter table public.br_delivery_lines alter column delivered_date set not null;
notify pgrst, 'reload schema';
commit;
