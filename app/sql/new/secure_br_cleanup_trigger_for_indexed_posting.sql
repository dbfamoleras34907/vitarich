-- Run the authoritative Broiler Clean Up inventory trigger as its trusted
-- postgres owner. Authenticated callers are still authorized by the outer
-- br_cleanup UPDATE/RPC, while the trigger's internal ledger queries avoid
-- row-by-row RLS access checks that prevent indexed balance lookups.

begin;

do $guard$
declare
  v_owner text;
  v_trigger_count integer;
  v_definition text;
begin
  select pg_get_userbyid(proc.proowner), pg_get_functiondef(proc.oid)
  into v_owner, v_definition
  from pg_proc proc
  join pg_namespace namespace on namespace.oid = proc.pronamespace
  where namespace.nspname = 'public'
    and proc.proname = 'post_br_cleanup_inventory'
    and proc.pronargs = 0
    and proc.prorettype = 'trigger'::regtype;

  if v_owner is null then
    raise exception 'public.post_br_cleanup_inventory() was not found; no changes applied.';
  end if;

  if v_owner <> 'postgres' then
    raise exception 'Unexpected post_br_cleanup_inventory owner %; no changes applied.', v_owner;
  end if;

  if position('public.inventory_postings' in v_definition) = 0
     or position('public.br_cleanup_lines' in v_definition) = 0 then
    raise exception 'Unexpected post_br_cleanup_inventory definition; no changes applied.';
  end if;

  select count(*)
  into v_trigger_count
  from pg_trigger trigger
  join pg_class relation on relation.oid = trigger.tgrelid
  join pg_namespace namespace on namespace.oid = relation.relnamespace
  where not trigger.tgisinternal
    and trigger.tgfoid = 'public.post_br_cleanup_inventory()'::regprocedure
    and namespace.nspname = 'public'
    and relation.relname = 'br_cleanup'
    and trigger.tgname = 'post_br_cleanup_inventory_trigger';

  if v_trigger_count <> 1 then
    raise exception 'Expected one Broiler Clean Up inventory trigger, found %; no changes applied.', v_trigger_count;
  end if;
end;
$guard$;

alter function public.post_br_cleanup_inventory() security definer;
alter function public.post_br_cleanup_inventory()
  set search_path = pg_catalog, public;

-- Trigger functions cannot be invoked as ordinary RPCs. Keep execution with
-- the owner and the already-created trigger only.
revoke all on function public.post_br_cleanup_inventory()
  from public, anon, authenticated, service_role;

commit;
