-- Supports the bounded Hatchery DOC Dispatch list query:
-- active dispatches in a selected document-date range, newest first.
-- Kept transaction-compatible for Supabase SQL Editor. Schedule during a
-- quieter period if the production dispatch tables are very large.
create index if not exists dispatch_doc_active_doc_date_id_idx
  on public.dispatch_doc (doc_date desc, id desc)
  where is_active is true;

-- Supports loading the source DOC batch codes for the selected headers.
create index if not exists dispatch_doc_item_dispatch_doc_batch_idx
  on public.dispatch_doc_item (dispatch_doc_id, doc_batch_code);

-- Supports resolving the Hatchery farm that owns each selected DOC batch.
create index if not exists chick_grading_process_batch_farm_idx
  on public.chick_grading_process (batch_code, farm_id);
