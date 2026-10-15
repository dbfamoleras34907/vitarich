alter table public.doc_rec_settings
  add column if not exists suppress_seven_day_placement_condition boolean not null default false;

comment on column public.doc_rec_settings.suppress_seven_day_placement_condition is
  'When true, DOC Placement does not enforce the seven-calendar-date window from the building first placement date.';

notify pgrst, 'reload schema';
