create table if not exists public.flock_card (
  id bigint generated always as identity not null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_by uuid null,
  updated_at timestamp with time zone null,
  card_no text not null,
  farm_id bigint null,
  farm_code text null,
  farm_name text null,
  building_id bigint null,
  building_whse_id bigint null,
  building_src text null,
  building_key text null,
  building_code text null,
  building_name text null,
  age integer not null default 0,
  start_date date not null default current_date,
  broiler_type text null,
  breed text null,
  guideline text null,
  cocci_prg_id text null,
  other_prg_id text null,
  vacc_prg_id text null,
  flock_code text null,
  trial_code text null,
  cycle_no text null,
  animal_qty numeric(18, 6) not null default 0,
  feedmill text null,
  stock_density numeric(18, 6) null,
  stock_density_wt numeric(18, 6) null,
  sex text null,
  status text not null default 'Saved',
  remarks text null,
  extra jsonb not null default '{}'::jsonb,
  void text not null default '1',
  constraint flock_card_pkey primary key (id),
  constraint flock_card_card_no_key unique (card_no),
  constraint flock_card_status_check check (status in ('Saved', 'Cancelled')),
  constraint flock_card_void_check check (void in ('0', '1')),
  constraint flock_card_age_check check (age >= 0),
  constraint flock_card_qty_check check (
    animal_qty >= 0
    and coalesce(stock_density, 0) >= 0
    and coalesce(stock_density_wt, 0) >= 0
  ),
  constraint flock_card_farm_id_fkey foreign key (farm_id) references public.farms (id),
  constraint flock_card_building_id_fkey foreign key (building_id) references public.farm_buildings (id),
  constraint flock_card_building_whse_id_fkey foreign key (building_whse_id) references public.i_warehouse (id),
  constraint flock_card_created_by_fkey foreign key (created_by) references auth.users (id),
  constraint flock_card_updated_by_fkey foreign key (updated_by) references auth.users (id)
);

alter table public.flock_card
  add column if not exists building_whse_id bigint null,
  add column if not exists building_src text null;

do $$
begin
  alter table public.flock_card
    drop constraint if exists flock_card_building_whse_id_fkey;

  alter table public.flock_card
    add constraint flock_card_building_whse_id_fkey
    foreign key (building_whse_id) references public.i_warehouse (id);
end;
$$;

create table if not exists public.flock_card_origin (
  id bigint generated always as identity not null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_by uuid null,
  updated_at timestamp with time zone null,
  fc_id bigint not null,
  line_no integer not null default 1,
  item_id bigint null,
  item_code text null,
  item_name text null,
  batch_no text not null,
  whse_id bigint null,
  whse_code text null,
  whse_name text null,
  gr_origin text null,
  animal_qty numeric(18, 6) not null default 0,
  onhand_snapshot numeric(18, 6) not null default 0,
  breed text null,
  mfg_date date null,
  exp_date date null,
  extra jsonb not null default '{}'::jsonb,
  void text not null default '1',
  constraint flock_card_origin_pkey primary key (id),
  constraint flock_card_origin_void_check check (void in ('0', '1')),
  constraint flock_card_origin_qty_check check (animal_qty >= 0 and onhand_snapshot >= 0),
  constraint flock_card_origin_fc_id_fkey foreign key (fc_id) references public.flock_card (id),
  constraint flock_card_origin_item_id_fkey foreign key (item_id) references public.items (id),
  constraint flock_card_origin_whse_id_fkey foreign key (whse_id) references public.i_warehouse (id),
  constraint flock_card_origin_created_by_fkey foreign key (created_by) references auth.users (id),
  constraint flock_card_origin_updated_by_fkey foreign key (updated_by) references auth.users (id)
);

create index if not exists flock_card_farm_idx
  on public.flock_card (farm_id);

create index if not exists flock_card_building_idx
  on public.flock_card (building_id);

create index if not exists flock_card_start_idx
  on public.flock_card (start_date desc);

create index if not exists flock_card_status_idx
  on public.flock_card (status);

create index if not exists flock_card_void_idx
  on public.flock_card (void);

create index if not exists flock_card_origin_fc_idx
  on public.flock_card_origin (fc_id);

create unique index if not exists flock_card_origin_line_active_key
  on public.flock_card_origin (fc_id, line_no)
  where void = '1';

create index if not exists flock_card_origin_batch_idx
  on public.flock_card_origin (item_code, batch_no, whse_code);

create index if not exists flock_card_origin_void_idx
  on public.flock_card_origin (void);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_flock_card_updated_at'
  ) then
    create trigger set_flock_card_updated_at
    before update on public.flock_card
    for each row
    execute function public.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_flock_card_origin_updated_at'
  ) then
    create trigger set_flock_card_origin_updated_at
    before update on public.flock_card_origin
    for each row
    execute function public.set_updated_at();
  end if;
end;
$$;

create or replace function public.post_flock_card_origin_inventory()
returns trigger
language plpgsql
as $$
declare
  v_card record;
  v_fc_id bigint;
  v_dest_whse_code text;
  v_user uuid;
  v_source_doc_type text;
begin
  if tg_op = 'INSERT' then
    v_fc_id := new.fc_id;
  else
    v_fc_id := coalesce(new.fc_id, old.fc_id);
  end if;

  select
    fc.id,
    fc.card_no,
    fc.building_code,
    fc.building_whse_id,
    fc.created_by,
    fc.updated_by,
    iw.whse_code as building_whse_code
  into v_card
  from public.flock_card fc
  left join public.i_warehouse iw
    on iw.id = fc.building_whse_id
  where fc.id = v_fc_id;

  if v_card.id is null then
    raise exception 'Unable to post flock origin inventory: flock_card % was not found', v_fc_id;
  end if;

  v_dest_whse_code := nullif(btrim(coalesce(v_card.building_code, v_card.building_whse_code, '')), '');
  v_user := coalesce(new.updated_by, new.created_by, v_card.updated_by, v_card.created_by, auth.uid());

  if v_user is null then
    raise exception 'Unable to post flock origin inventory: created_by is required';
  end if;

  if tg_op = 'INSERT' then
    if new.void <> '1' then
      return new;
    end if;

    if nullif(btrim(coalesce(new.item_code, '')), '') is null then
      raise exception 'Unable to post flock origin inventory: item_code is required';
    end if;

    if nullif(btrim(coalesce(new.whse_code, '')), '') is null then
      raise exception 'Unable to post flock origin inventory: source warehouse is required';
    end if;

    if v_dest_whse_code is null then
      raise exception 'Unable to post flock origin inventory: destination building warehouse is required';
    end if;

    if coalesce(new.animal_qty, 0) <= 0 then
      raise exception 'Unable to post flock origin inventory: animal_qty must be greater than zero';
    end if;

    insert into public.inventory_postings (
      source_doc_type,
      source_docentry,
      item_code,
      warehouse_code,
      bin_code,
      batch_number,
      qty,
      created_by,
      ref_type,
      ref,
      transfer_type,
      ref_type2,
      ref2
    )
    values
      (
        'FLOCK_CARD_ORIGIN',
        new.id,
        new.item_code,
        new.whse_code,
        'DEFAULT',
        new.batch_no,
        new.animal_qty,
        v_user,
        'BATCH_CODE',
        new.batch_no,
        'OUT',
        'FLOCK_CARD',
        v_card.card_no
      ),
      (
        'FLOCK_CARD_ORIGIN',
        new.id,
        new.item_code,
        v_dest_whse_code,
        'DEFAULT',
        new.batch_no,
        new.animal_qty,
        v_user,
        'BATCH_CODE',
        new.batch_no,
        'IN',
        'FLOCK_CARD',
        v_card.card_no
      );

    return new;
  end if;

  if tg_op = 'UPDATE' and old.void = '1' and new.void = '0' then
    v_source_doc_type := 'FLOCK_CARD_ORIGIN_VOID';

    if nullif(btrim(coalesce(old.item_code, '')), '') is null
      or nullif(btrim(coalesce(old.whse_code, '')), '') is null
      or v_dest_whse_code is null
      or coalesce(old.animal_qty, 0) <= 0 then
      return new;
    end if;

    insert into public.inventory_postings (
      source_doc_type,
      source_docentry,
      item_code,
      warehouse_code,
      bin_code,
      batch_number,
      qty,
      created_by,
      ref_type,
      ref,
      transfer_type,
      ref_type2,
      ref2
    )
    values
      (
        v_source_doc_type,
        old.id,
        old.item_code,
        old.whse_code,
        'DEFAULT',
        old.batch_no,
        old.animal_qty,
        v_user,
        'BATCH_CODE',
        old.batch_no,
        'IN',
        'FLOCK_CARD',
        v_card.card_no
      ),
      (
        v_source_doc_type,
        old.id,
        old.item_code,
        v_dest_whse_code,
        'DEFAULT',
        old.batch_no,
        old.animal_qty,
        v_user,
        'BATCH_CODE',
        old.batch_no,
        'OUT',
        'FLOCK_CARD',
        v_card.card_no
      );

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists post_flock_card_origin_inventory_insert on public.flock_card_origin;
create trigger post_flock_card_origin_inventory_insert
after insert on public.flock_card_origin
for each row
execute function public.post_flock_card_origin_inventory();

drop trigger if exists post_flock_card_origin_inventory_void on public.flock_card_origin;
create trigger post_flock_card_origin_inventory_void
after update of void on public.flock_card_origin
for each row
when (old.void is distinct from new.void)
execute function public.post_flock_card_origin_inventory();

create index if not exists inventory_postings_flock_origin_idx
  on public.inventory_postings (source_doc_type, source_docentry)
  where source_doc_type in ('FLOCK_CARD_ORIGIN', 'FLOCK_CARD_ORIGIN_VOID');
