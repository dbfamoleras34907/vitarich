update public.goods_receipt
set status = 'Posted'
where status = 'Received';

update public.goods_receipt
set status = 'Draft'
where status is null
   or status not in ('Draft', 'Posted', 'Cancelled');

alter table public.goods_receipt
  drop constraint if exists goods_reciept_status_check;

alter table public.goods_receipt
  add constraint goods_reciept_status_check
  check (status in ('Draft', 'Posted', 'Cancelled'));

select
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.goods_receipt'::regclass
  and conname = 'goods_reciept_status_check';
