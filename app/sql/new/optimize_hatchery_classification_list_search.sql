-- Hatchery Egg Classification: support the all-date Breeder Ref. No. lookup
-- used by the Classified Eggs table.
--
-- Production already has hatch_classification_farm_date_id_idx on
-- (farm_id, date_classify desc, id desc), so do not create a duplicate btree
-- index under another name. The only optional index below is for substring
-- ILIKE searches; it does not address Pending Classification view timeouts.

-- A btree index cannot efficiently support ILIKE '%reference%'. pg_trgm keeps
-- partial reference searches bounded without requiring all rows in the client.
create extension if not exists pg_trgm;

create index if not exists hatch_classification_br_no_trgm_idx
  on public.hatch_classification
  using gin (br_no gin_trgm_ops);

-- Validate the normal browse path (replace the farm/date values):
-- explain (analyze, buffers)
-- select id, date_classify, br_no, farm_id
-- from public.hatch_classification
-- where farm_id in (123) and date_classify between date '2026-10-14' and date '2026-11-13'
-- order by id desc
-- limit 50;
--
-- Validate the historical Breeder Ref. search path:
-- explain (analyze, buffers)
-- select id, date_classify, br_no, farm_id
-- from public.hatch_classification
-- where farm_id in (123) and br_no ilike '%JYH 12/25-26/25-1-0%'
-- order by id desc
-- limit 50;
