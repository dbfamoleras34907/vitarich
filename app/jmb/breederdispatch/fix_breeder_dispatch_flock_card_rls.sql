begin;

-- Dispatch posting is initiated by an authenticated update on tbl_brd_dispatch,
-- but its controlled flock-card mutation must not inherit the caller's RLS
-- restrictions on tbl_breeder_daily_performance.
alter function public.apply_brd_dispatch_to_flock_card()
  security definer;

alter function public.apply_brd_dispatch_to_flock_card()
  set search_path = public, pg_temp;

revoke all on function public.apply_brd_dispatch_to_flock_card() from public;

commit;
