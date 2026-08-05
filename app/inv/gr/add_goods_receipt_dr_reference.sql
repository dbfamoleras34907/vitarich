alter table public.goods_receipt
  add column if not exists dr_reference text;

update public.goods_receipt
set dr_reference = gr_no
where dr_reference is null or btrim(dr_reference) = '';

alter table public.goods_receipt
  alter column dr_reference set not null;
