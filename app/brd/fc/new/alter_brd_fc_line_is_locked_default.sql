update public.brd_fc_line
set is_locked = false
where is_locked is null;

alter table public.brd_fc_line
  alter column is_locked set default false,
  alter column is_locked set not null;

notify pgrst, 'reload schema';
