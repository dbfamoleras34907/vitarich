alter table public.goods_receipt_doc
  add column if not exists doc_source text;

comment on column public.goods_receipt_doc.doc_source is
  'DOC source recorded for the individual DOC Placement detail line.';
