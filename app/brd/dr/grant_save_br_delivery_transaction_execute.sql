-- Repair Harvest & Delivery RPC access without recreating the transaction function.
-- Run as a database owner (for example, from the Supabase SQL Editor).
begin;

do $$
begin
  if to_regprocedure('public.save_br_delivery_transaction(jsonb)') is null then
    raise exception 'public.save_br_delivery_transaction(jsonb) does not exist';
  end if;
end;
$$;

revoke all on function public.save_br_delivery_transaction(jsonb) from public;
revoke all on function public.save_br_delivery_transaction(jsonb) from anon;
grant execute on function public.save_br_delivery_transaction(jsonb) to authenticated;

do $$
begin
  if not has_function_privilege(
    'authenticated',
    'public.save_br_delivery_transaction(jsonb)',
    'EXECUTE'
  ) then
    raise exception 'authenticated still does not have EXECUTE on public.save_br_delivery_transaction(jsonb)';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
