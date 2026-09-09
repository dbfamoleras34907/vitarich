begin;

alter table public.inventory_postings
  add column if not exists batch_number text null;

update public.inventory_postings
set batch_number = case
  when upper(coalesce(ref_type, '')) = 'BATCH_CODE' then nullif(btrim(ref), '')
  when upper(coalesce(ref_type2, '')) = 'BATCH_CODE' then nullif(btrim(ref2), '')
  else batch_number
end
where batch_number is null
   or btrim(batch_number) = '';

create index if not exists inventory_postings_batch_number_idx
  on public.inventory_postings (item_code, warehouse_code, batch_number);

create or replace function public.sync_inventory_posting_batch_number()
returns trigger
language plpgsql
as $$
begin
  if nullif(btrim(coalesce(new.batch_number, '')), '') is null then
    new.batch_number := case
      when upper(coalesce(new.ref_type, '')) = 'BATCH_CODE' then nullif(btrim(new.ref), '')
      when upper(coalesce(new.ref_type2, '')) = 'BATCH_CODE' then nullif(btrim(new.ref2), '')
      else null
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_inventory_posting_batch_number_trigger
  on public.inventory_postings;

create trigger sync_inventory_posting_batch_number_trigger
before insert or update of ref, ref_type, ref2, ref_type2, batch_number
on public.inventory_postings
for each row
execute function public.sync_inventory_posting_batch_number();

commit;
