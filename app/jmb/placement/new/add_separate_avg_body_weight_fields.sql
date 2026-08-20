begin;

alter table public.tbl_placement
  add column if not exists f_avg_bodyw numeric(18, 2),
  add column if not exists m_avg_bodyw numeric(18, 2);

update public.tbl_placement
set f_avg_bodyw = coalesce(f_avg_bodyw, avg_bodyw),
    m_avg_bodyw = coalesce(m_avg_bodyw, avg_bodyw)
where f_avg_bodyw is null
   or m_avg_bodyw is null;

alter table public.tbl_placement
  drop constraint if exists tbl_placement_f_avg_bodyw_check,
  drop constraint if exists tbl_placement_m_avg_bodyw_check;

alter table public.tbl_placement
  add constraint tbl_placement_f_avg_bodyw_check
    check (f_avg_bodyw is null or f_avg_bodyw >= 0),
  add constraint tbl_placement_m_avg_bodyw_check
    check (m_avg_bodyw is null or m_avg_bodyw >= 0);

commit;
