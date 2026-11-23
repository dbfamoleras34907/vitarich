-- Reusable lookup for inventory rows belonging to one authoritative source
-- document. DOC Placement posting uses this before creating GOODS_RECEIPT,
-- DOC_RECEIVING_CONSOLIDATION, and DOC_RECEIVING_AUTO_USAGE ledger rows.
-- Other posting, reversal, and notification paths use the same identity.
create index if not exists inventory_postings_source_document_idx
  on public.inventory_postings (source_doc_type, source_docentry);
