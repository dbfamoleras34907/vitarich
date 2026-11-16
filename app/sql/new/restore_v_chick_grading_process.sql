-- Restores the read model used by Hatchery > DOC Classification.
--
-- Total Egg Set is the sum of every Egg Setter qty_set_egg row whose ref_no
-- exactly matches chick_grading_process.egg_ref_no.  Classifications are not
-- subtracted from that quantity.
--
-- The view is security-invoker so callers remain subject to the RLS policies
-- on chick_grading_process, setter_incubation_process, hatch_classification,
-- and farms.

create or replace view public.v_chick_grading_process
with (security_invoker = on) as
select
  g.id,
  g.created_at,
  g.created_by,
  g.updated_at,
  g.updated_by,
  g.batch_code,
  g.egg_ref_no,
  g.class_a,
  g.class_b,
  g.class_a_junior,
  g.class_c,
  g.cull_chicks,
  g.dead_chicks,
  g.infertile,
  g.dead_germ,
  g.live_pip,
  g.dead_pip,
  g.unhatched,
  g.rotten,
  g.exploder,
  g.unhatched_good,
  g.unhatched_bad,
  g.infertile_good,
  g.infertile_bad,
  g.chick_room_temperature,
  g.grading_personnel,
  g.grading_datetime,
  source_farm.name as farm_source,
  coalesce(setter.total_egg_set, 0::numeric) as total_chicks,
  coalesce(g.class_a, 0)::numeric as good_quality_chicks,
  round(
    coalesce(g.class_a, 0)::numeric
      * 100
      / nullif(setter.total_egg_set, 0),
    2
  ) as quality_grade_rate,
  round(
    coalesce(g.cull_chicks, 0)::numeric
      * 100
      / nullif(setter.total_egg_set, 0),
    2
  ) as cull_rate
from public.chick_grading_process as g
left join lateral (
  select sum(s.qty_set_egg)::numeric as total_egg_set
  from public.setter_incubation_process as s
  where btrim(s.ref_no) = btrim(g.egg_ref_no)
) as setter on true
left join lateral (
  select f.name
  from public.hatch_classification as h
  join public.farms as f on f.id = h.farm_id
  where btrim(h.classi_ref_no) = btrim(g.egg_ref_no)
  order by h.id desc
  limit 1
) as source_farm on true;

grant select on public.v_chick_grading_process to authenticated;

-- Verify after deployment with an authenticated Hatchery user:
-- select id, egg_ref_no, farm_source, total_chicks, good_quality_chicks,
--        quality_grade_rate, cull_rate
-- from public.v_chick_grading_process
-- order by id desc
-- limit 20;
