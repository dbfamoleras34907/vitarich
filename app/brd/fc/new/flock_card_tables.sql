create table if not exists public.brd_fc (
  id bigint generated always as identity not null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_by uuid null,
  updated_at timestamp with time zone null,
  fc_no text not null,
  card_no text null,
  fc_date date not null default current_date,
  farm_id bigint null,
  farm_code text null,
  farm_name text null,
  building_id bigint null,
  building_whse_id bigint null,
  building_src text null,
  building_key text null,
  building_code text null,
  building_name text null,
  building_status text null,
  feed_whse_id bigint null,
  feed_whse_code text null,
  feed_whse_name text null,
  animal_qty numeric(18, 6) not null default 0,
  status text not null default 'Draft',
  remarks text null,
  void text not null default '1',
  constraint brd_fc_pkey primary key (id),
  constraint brd_fc_fc_no_key unique (fc_no),
  constraint brd_fc_status_check check (status in ('Draft', 'Posted', 'Cancelled')),
  constraint brd_fc_building_src_check check (building_src is null or building_src in ('BUILDING', 'WAREHOUSE')),
  constraint brd_fc_void_check check (void in ('0', '1')),
  constraint brd_fc_animal_qty_check check (animal_qty >= 0),
  constraint brd_fc_farm_id_fkey foreign key (farm_id) references public.farms (id),
  constraint brd_fc_building_id_fkey foreign key (building_id) references public.farm_buildings (id),
  constraint brd_fc_building_whse_id_fkey foreign key (building_whse_id) references public.i_warehouse (id),
  constraint brd_fc_feed_whse_id_fkey foreign key (feed_whse_id) references public.i_warehouse (id),
  constraint brd_fc_created_by_fkey foreign key (created_by) references auth.users (id),
  constraint brd_fc_updated_by_fkey foreign key (updated_by) references auth.users (id)
);

create table if not exists public.brd_fc_line (
  id bigint generated always as identity not null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_by uuid null,
  updated_at timestamp with time zone null,
  fc_id bigint not null,
  age integer not null,
  mort_am numeric(18, 6) null,
  mort_pm numeric(18, 6) null,
  mort_total numeric(18, 6) null,
  thin_am numeric(18, 6) null,
  thin_pm numeric(18, 6) null,
  row_total numeric(18, 6) null,
  cum_total numeric(18, 6) null,
  feed_kg numeric(18, 6) null,
  feed_bird numeric(18, 6) null,
  feed_guideline numeric(18, 6) null,
  feed_batch_text text null,
  water_l numeric(18, 6) null,
  water_bird numeric(18, 6) null,
  body_wt numeric(18, 6) null,
  body_guideline numeric(18, 6) null,
  temp_min numeric(18, 6) null,
  temp_max numeric(18, 6) null,
  hum_min numeric(18, 6) null,
  hum_max numeric(18, 6) null,
  nh3_max numeric(18, 6) null,
  skin_b numeric(18, 6) null,
  skin_a numeric(18, 6) null,
  skin_l numeric(18, 6) null,
  extra jsonb not null default '{}'::jsonb,
  is_locked boolean not null default false,
  reversed_at timestamp with time zone null,
  reversed_by uuid null,
  reversal_reason text null,
  void text not null default '1',
  constraint brd_fc_line_pkey primary key (id),
  constraint brd_fc_line_void_check check (void in ('0', '1')),
  constraint brd_fc_line_age_check check (age >= 0),
  constraint brd_fc_line_nonneg_check check (
    coalesce(mort_am, 0) >= 0
    and coalesce(mort_pm, 0) >= 0
    and coalesce(mort_total, 0) >= 0
    and coalesce(thin_am, 0) >= 0
    and coalesce(thin_pm, 0) >= 0
    and coalesce(row_total, 0) >= 0
    and coalesce(cum_total, 0) >= 0
    and coalesce(feed_kg, 0) >= 0
    and coalesce(feed_bird, 0) >= 0
    and coalesce(feed_guideline, 0) >= 0
    and coalesce(water_l, 0) >= 0
    and coalesce(water_bird, 0) >= 0
    and coalesce(body_wt, 0) >= 0
    and coalesce(body_guideline, 0) >= 0
    and coalesce(nh3_max, 0) >= 0
  ),
  constraint brd_fc_line_fc_id_fkey foreign key (fc_id) references public.brd_fc (id) on delete cascade,
  constraint brd_fc_line_created_by_fkey foreign key (created_by) references auth.users (id),
  constraint brd_fc_line_updated_by_fkey foreign key (updated_by) references auth.users (id),
  constraint brd_fc_line_reversed_by_fkey foreign key (reversed_by) references auth.users (id)
);

create table if not exists public.brd_fc_ba (
  id bigint generated always as identity not null,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_by uuid null,
  updated_at timestamp with time zone null,
  fc_line_id bigint not null,
  line_no integer not null,
  item_id bigint null,
  item_code text not null,
  item_name text null,
  batch_no text not null,
  whse_id bigint null,
  whse_code text not null,
  whse_name text null,
  alloc_qty numeric(18, 6) not null default 0,
  onhand_snapshot numeric(18, 6) not null default 0,
  mfg_date date null,
  exp_date date null,
  source text not null default 'MANUAL',
  reversed_at timestamp with time zone null,
  reversed_by uuid null,
  reversal_reason text null,
  void text not null default '1',
  constraint brd_fc_ba_pkey primary key (id),
  constraint brd_fc_ba_source_check check (source in ('MANUAL', 'FIFO')),
  constraint brd_fc_ba_void_check check (void in ('0', '1')),
  constraint brd_fc_ba_qty_check check (alloc_qty >= 0 and onhand_snapshot >= 0),
  constraint brd_fc_ba_fc_line_id_fkey foreign key (fc_line_id) references public.brd_fc_line (id) on delete cascade,
  constraint brd_fc_ba_item_id_fkey foreign key (item_id) references public.items (id),
  constraint brd_fc_ba_whse_id_fkey foreign key (whse_id) references public.i_warehouse (id),
  constraint brd_fc_ba_created_by_fkey foreign key (created_by) references auth.users (id),
  constraint brd_fc_ba_updated_by_fkey foreign key (updated_by) references auth.users (id),
  constraint brd_fc_ba_reversed_by_fkey foreign key (reversed_by) references auth.users (id)
);

alter table public.brd_fc
  add column if not exists card_no text null,
  add column if not exists building_id bigint null,
  add column if not exists building_whse_id bigint null,
  add column if not exists building_src text null,
  add column if not exists building_key text null,
  add column if not exists building_code text null,
  add column if not exists building_name text null,
  add column if not exists building_status text null;

alter table public.brd_fc_line
  add column if not exists is_locked boolean not null default false,
  add column if not exists reversed_at timestamp with time zone null,
  add column if not exists reversed_by uuid null,
  add column if not exists reversal_reason text null;

alter table public.brd_fc_ba
  add column if not exists reversed_at timestamp with time zone null,
  add column if not exists reversed_by uuid null,
  add column if not exists reversal_reason text null;

create index if not exists brd_fc_date_idx
  on public.brd_fc (fc_date desc);

create index if not exists brd_fc_card_no_idx
  on public.brd_fc (card_no);

update public.brd_fc daily
set card_no = (
  select placement.card_no
  from public.flock_card placement
  where placement.farm_id = daily.farm_id
    and placement.void = '1'
    and placement.status = 'Saved'
    and placement.card_no is not null
    and (
      (daily.building_whse_id is not null and placement.building_whse_id = daily.building_whse_id)
      or (daily.building_id is not null and placement.building_id = daily.building_id)
      or (nullif(daily.building_key, '') is not null and placement.building_key = daily.building_key)
      or (nullif(daily.building_code, '') is not null and placement.building_code = daily.building_code)
    )
  order by placement.start_date desc, placement.id desc
  limit 1
)
where daily.card_no is null
  and exists (
    select 1
    from public.flock_card placement
    where placement.farm_id = daily.farm_id
      and placement.void = '1'
      and placement.status = 'Saved'
      and placement.card_no is not null
      and (
        (daily.building_whse_id is not null and placement.building_whse_id = daily.building_whse_id)
        or (daily.building_id is not null and placement.building_id = daily.building_id)
        or (nullif(daily.building_key, '') is not null and placement.building_key = daily.building_key)
        or (nullif(daily.building_code, '') is not null and placement.building_code = daily.building_code)
      )
  );

create index if not exists brd_fc_farm_idx
  on public.brd_fc (farm_id);

create index if not exists brd_fc_building_idx
  on public.brd_fc (building_id);

create index if not exists brd_fc_building_whse_idx
  on public.brd_fc (building_whse_id);

create index if not exists brd_fc_building_key_idx
  on public.brd_fc (building_key);

create index if not exists brd_fc_building_code_idx
  on public.brd_fc (building_code);

create index if not exists brd_fc_status_idx
  on public.brd_fc (status);

create index if not exists brd_fc_void_idx
  on public.brd_fc (void);

create index if not exists brd_fc_line_fc_idx
  on public.brd_fc_line (fc_id);

create unique index if not exists brd_fc_line_fc_age_active_key
  on public.brd_fc_line (fc_id, age)
  where void = '1';

create index if not exists brd_fc_line_void_idx
  on public.brd_fc_line (void);

create index if not exists brd_fc_line_reversed_idx
  on public.brd_fc_line (reversed_at);

create index if not exists brd_fc_ba_fc_line_idx
  on public.brd_fc_ba (fc_line_id);

create unique index if not exists brd_fc_ba_line_active_key
  on public.brd_fc_ba (fc_line_id, line_no)
  where void = '1';

create index if not exists brd_fc_ba_batch_idx
  on public.brd_fc_ba (item_code, batch_no, whse_code);

create index if not exists brd_fc_ba_void_idx
  on public.brd_fc_ba (void);

create index if not exists brd_fc_ba_reversed_idx
  on public.brd_fc_ba (reversed_at);

do $$
begin
  alter table public.brd_fc
    add column if not exists card_no text null,
    add column if not exists building_id bigint null,
    add column if not exists building_whse_id bigint null,
    add column if not exists building_src text null,
    add column if not exists building_key text null,
    add column if not exists building_code text null,
    add column if not exists building_name text null,
    add column if not exists building_status text null;

  alter table public.brd_fc
    drop constraint if exists brd_fc_building_id_fkey;

  alter table public.brd_fc
    add constraint brd_fc_building_id_fkey
    foreign key (building_id) references public.farm_buildings (id);

  alter table public.brd_fc
    drop constraint if exists brd_fc_building_whse_id_fkey;

  alter table public.brd_fc
    add constraint brd_fc_building_whse_id_fkey
    foreign key (building_whse_id) references public.i_warehouse (id);

  alter table public.brd_fc
    drop constraint if exists brd_fc_building_src_check;

  alter table public.brd_fc
    add constraint brd_fc_building_src_check
    check (building_src is null or building_src in ('BUILDING', 'WAREHOUSE'));

  alter table public.brd_fc
    drop constraint if exists brd_fc_status_check;

  update public.brd_fc
  set status = 'Draft'
  where status = 'Saved'
     or status is null;

  alter table public.brd_fc
    alter column status set default 'Draft';

  alter table public.brd_fc
    add constraint brd_fc_status_check
    check (status in ('Draft', 'Posted', 'Cancelled'));

  alter table public.brd_fc_line
    add column if not exists is_locked boolean not null default false,
    add column if not exists reversed_at timestamp with time zone null,
    add column if not exists reversed_by uuid null,
    add column if not exists reversal_reason text null;

  alter table public.brd_fc_line
    drop constraint if exists brd_fc_line_reversed_by_fkey;

  alter table public.brd_fc_line
    add constraint brd_fc_line_reversed_by_fkey
    foreign key (reversed_by) references auth.users (id);

  alter table public.brd_fc_ba
    add column if not exists reversed_at timestamp with time zone null,
    add column if not exists reversed_by uuid null,
    add column if not exists reversal_reason text null;

  alter table public.brd_fc_ba
    drop constraint if exists brd_fc_ba_reversed_by_fkey;

  alter table public.brd_fc_ba
    add constraint brd_fc_ba_reversed_by_fkey
    foreign key (reversed_by) references auth.users (id);
end;
$$;

create or replace function public.post_brd_fc_feed_inventory()
returns trigger
language plpgsql
as $$
declare
  v_line record;
  v_card record;
  v_user uuid;
  v_on_hand numeric(18, 6);
begin
  if tg_op = 'INSERT' then
    if new.void <> '1' then
      return new;
    end if;

    if nullif(btrim(coalesce(new.item_code, '')), '') is null then
      raise exception 'Unable to post flock card feed usage: item_code is required';
    end if;

    if nullif(btrim(coalesce(new.whse_code, '')), '') is null then
      raise exception 'Unable to post flock card feed usage: warehouse is required';
    end if;

    if nullif(btrim(coalesce(new.batch_no, '')), '') is null then
      raise exception 'Unable to post flock card feed usage: batch_no is required';
    end if;

    if coalesce(new.alloc_qty, 0) <= 0 then
      return new;
    end if;

    select *
    into v_line
    from public.brd_fc_line
    where id = new.fc_line_id;

    if not found then
      raise exception 'Unable to post flock card feed usage: flock card line % was not found', new.fc_line_id;
    end if;

    select *
    into v_card
    from public.brd_fc
    where id = v_line.fc_id;

    if not found then
      raise exception 'Unable to post flock card feed usage: flock card was not found for allocation %', new.id;
    end if;

    v_user := coalesce(new.updated_by, new.created_by, v_line.updated_by, v_line.created_by, v_card.updated_by, v_card.created_by, auth.uid());

    if v_user is null then
      raise exception 'Unable to post flock card feed usage: created_by is required';
    end if;

    if exists (
      select 1
      from public.inventory_postings ip
      where ip.source_doc_type = 'BRD_FC_FEED_USAGE'
        and ip.source_docentry = new.id
    ) then
      return new;
    end if;

    select coalesce(sum(case when ip.transfer_type = 'OUT' then -ip.qty else ip.qty end), 0)
    into v_on_hand
    from public.inventory_postings ip
    where ip.item_code = new.item_code
      and ip.warehouse_code = new.whse_code
      and ip.ref is not distinct from new.batch_no;

    if new.alloc_qty > v_on_hand then
      raise exception 'Flock card feed usage exceeds on-hand inventory for item %, batch %, warehouse %.',
        new.item_code, new.batch_no, new.whse_code;
    end if;

    insert into public.inventory_postings (
      source_doc_type,
      source_docentry,
      item_code,
      warehouse_code,
      bin_code,
      qty,
      created_by,
      ref_type,
      ref,
      transfer_type,
      ref_type2,
      ref2
    )
    values (
      'BRD_FC_FEED_USAGE',
      new.id,
      new.item_code,
      new.whse_code,
      'MAIN SUB BIN',
      new.alloc_qty,
      v_user,
      'BATCH_CODE',
      new.batch_no,
      'OUT',
      'FLOCK_CARD',
      v_card.fc_no
    );

    return new;
  end if;

  if tg_op = 'UPDATE' and old.void = '1' and new.void = '0' then
    if nullif(btrim(coalesce(old.item_code, '')), '') is null
      or nullif(btrim(coalesce(old.whse_code, '')), '') is null
      or nullif(btrim(coalesce(old.batch_no, '')), '') is null
      or coalesce(old.alloc_qty, 0) <= 0 then
      return new;
    end if;

    select *
    into v_line
    from public.brd_fc_line
    where id = old.fc_line_id;

    if not found then
      raise exception 'Unable to post flock card feed reversal: flock card line % was not found', old.fc_line_id;
    end if;

    select *
    into v_card
    from public.brd_fc
    where id = v_line.fc_id;

    if not found then
      raise exception 'Unable to post flock card feed reversal: flock card was not found for allocation %', old.id;
    end if;

    v_user := coalesce(new.reversed_by, new.updated_by, old.updated_by, old.created_by, v_line.updated_by, v_line.created_by, v_card.updated_by, v_card.created_by, auth.uid());

    if v_user is null then
      raise exception 'Unable to post flock card feed reversal: created_by is required';
    end if;

    if exists (
      select 1
      from public.inventory_postings ip
      where ip.source_doc_type = 'BRD_FC_FEED_REVERSAL'
        and ip.source_docentry = old.id
    ) then
      return new;
    end if;

    insert into public.inventory_postings (
      source_doc_type,
      source_docentry,
      item_code,
      warehouse_code,
      bin_code,
      qty,
      created_by,
      ref_type,
      ref,
      transfer_type,
      ref_type2,
      ref2
    )
    values (
      'BRD_FC_FEED_REVERSAL',
      old.id,
      old.item_code,
      old.whse_code,
      'MAIN SUB BIN',
      old.alloc_qty,
      v_user,
      'BATCH_CODE',
      old.batch_no,
      'IN',
      'FLOCK_CARD',
      v_card.fc_no
    );

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists post_brd_fc_feed_inventory_insert on public.brd_fc_ba;
create trigger post_brd_fc_feed_inventory_insert
after insert on public.brd_fc_ba
for each row
execute function public.post_brd_fc_feed_inventory();

drop trigger if exists post_brd_fc_feed_inventory_void on public.brd_fc_ba;
create trigger post_brd_fc_feed_inventory_void
after update of void on public.brd_fc_ba
for each row
when (old.void is distinct from new.void)
execute function public.post_brd_fc_feed_inventory();

drop index if exists public.inventory_postings_brd_fc_feed_idx;

create unique index inventory_postings_brd_fc_feed_idx
  on public.inventory_postings (source_doc_type, source_docentry)
  where source_doc_type in ('BRD_FC_FEED_USAGE', 'BRD_FC_FEED_REVERSAL');

notify pgrst, 'reload schema';

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
    where tgname = 'set_brd_fc_updated_at'
  ) then
    create trigger set_brd_fc_updated_at
    before update on public.brd_fc
    for each row
    execute function public.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_brd_fc_line_updated_at'
  ) then
    create trigger set_brd_fc_line_updated_at
    before update on public.brd_fc_line
    for each row
    execute function public.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_brd_fc_ba_updated_at'
  ) then
    create trigger set_brd_fc_ba_updated_at
    before update on public.brd_fc_ba
    for each row
    execute function public.set_updated_at();
  end if;
end;
$$;
