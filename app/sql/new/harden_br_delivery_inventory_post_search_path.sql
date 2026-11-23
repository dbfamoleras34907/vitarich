-- Keep name resolution deterministic without changing invoker rights or RLS.
begin;

alter function public.post_br_delivery_inventory()
set search_path = public;

commit;
