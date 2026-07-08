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
      'batch_code',
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
      'batch_code',
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

drop function if exists public.reset_brd_fc_line_feed_intake(bigint, text);

create or replace function public.reverse_brd_fc_feed_intake(
  p_line_id bigint,
  p_reason text default null
)
returns table (id bigint, age integer)
language plpgsql
as $$
declare
  v_line record;
  v_card record;
  v_allocation record;
  v_user uuid;
begin
  v_user := auth.uid();

  select *
  into v_line
  from public.brd_fc_line line
  where line.id = p_line_id
    and line.void = '1'
  for update;

  if not found then
    raise exception 'Unable to reverse feed intake: flock card line % was not found', p_line_id;
  end if;

  select *
  into v_card
  from public.brd_fc card
  where card.id = v_line.fc_id
    and card.void = '1';

  if not found then
    raise exception 'Unable to reverse feed intake: flock card % was not found', v_line.fc_id;
  end if;

  v_user := coalesce(v_user, v_line.updated_by, v_line.created_by, v_card.updated_by, v_card.created_by);

  if v_user is null then
    raise exception 'Unable to reverse feed intake: user is required';
  end if;

  for v_allocation in
    select *
    from public.brd_fc_ba
    where fc_line_id = p_line_id
      and void = '1'
    order by line_no
    for update
  loop
    if coalesce(v_allocation.alloc_qty, 0) > 0
      and not exists (
        select 1
        from public.inventory_postings ip
        where ip.source_doc_type = 'BRD_FC_FEED_REVERSAL'
          and ip.source_docentry = v_allocation.id
      ) then
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
        v_allocation.id,
        v_allocation.item_code,
        v_allocation.whse_code,
        'MAIN SUB BIN',
        v_allocation.alloc_qty,
        v_user,
        'batch_code',
        v_allocation.batch_no,
        'IN',
        'FLOCK_CARD',
        v_card.fc_no
      );
    end if;

    update public.brd_fc_ba
    set
      void = '0',
      updated_by = v_user,
      reversed_by = v_user,
      reversed_at = coalesce(reversed_at, now()),
      reversal_reason = coalesce(nullif(btrim(p_reason), ''), reversal_reason, 'Reverse feed intake')
    where public.brd_fc_ba.id = v_allocation.id;
  end loop;

  return query
  update public.brd_fc_line line
  set
    feed_kg = null,
    feed_bird = null,
    feed_guideline = null,
    feed_batch_text = null,
    is_locked = false,
    updated_by = v_user,
    reversed_by = v_user,
    reversed_at = coalesce(line.reversed_at, now()),
    reversal_reason = coalesce(nullif(btrim(p_reason), ''), line.reversal_reason, 'Reverse feed intake')
  where line.id = p_line_id
    and line.void = '1'
  returning line.id, line.age;
end;
$$;

create or replace function public.save_brd_fc_feed_intake(
  p_line_id bigint,
  p_feed_kg numeric,
  p_feed_bird numeric,
  p_feed_guideline numeric,
  p_feed_batch_text text,
  p_allocations jsonb
)
returns table (id bigint, age integer)
language plpgsql
as $$
declare
  v_line record;
  v_card record;
  v_allocation record;
  v_old_allocation record;
  v_user uuid;
  v_on_hand numeric(18, 6);
  v_ba_id bigint;
  v_expected_allocation_count integer;
  v_saved_allocation_count integer;
begin
  if jsonb_typeof(coalesce(p_allocations, '[]'::jsonb)) <> 'array' then
    raise exception 'Unable to save feed intake: allocations must be an array';
  end if;

  v_expected_allocation_count := coalesce(jsonb_array_length(coalesce(p_allocations, '[]'::jsonb)), 0);

  if v_expected_allocation_count = 0 then
    raise exception 'Unable to save feed intake: at least one feed batch is required';
  end if;

  select *
  into v_line
  from public.brd_fc_line line
  where line.id = p_line_id
    and line.void = '1'
  for update;

  if not found then
    raise exception 'Unable to save feed intake: flock card line % was not found', p_line_id;
  end if;

  select *
  into v_card
  from public.brd_fc card
  where card.id = v_line.fc_id
    and card.void = '1';

  if not found then
    raise exception 'Unable to save feed intake: flock card % was not found', v_line.fc_id;
  end if;

  v_user := coalesce(auth.uid(), v_line.updated_by, v_line.created_by, v_card.updated_by, v_card.created_by);

  if v_user is null then
    raise exception 'Unable to save feed intake: user is required';
  end if;

  for v_old_allocation in
    select *
    from public.brd_fc_ba
    where fc_line_id = p_line_id
      and void = '1'
    order by line_no
    for update
  loop
    if coalesce(v_old_allocation.alloc_qty, 0) > 0
      and not exists (
        select 1
        from public.inventory_postings ip
        where ip.source_doc_type = 'BRD_FC_FEED_REVERSAL'
          and ip.source_docentry = v_old_allocation.id
      ) then
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
        v_old_allocation.id,
        v_old_allocation.item_code,
        v_old_allocation.whse_code,
        'MAIN SUB BIN',
        v_old_allocation.alloc_qty,
        v_user,
        'batch_code',
        v_old_allocation.batch_no,
        'IN',
        'FLOCK_CARD',
        v_card.fc_no
      );
    end if;

    update public.brd_fc_ba
    set
      void = '0',
      updated_by = v_user,
      reversed_by = v_user,
      reversed_at = coalesce(reversed_at, now()),
      reversal_reason = 'Replaced from flock card feed intake save'
    where public.brd_fc_ba.id = v_old_allocation.id;
  end loop;

  update public.brd_fc_line
  set
    feed_kg = p_feed_kg,
    feed_bird = p_feed_bird,
    feed_guideline = p_feed_guideline,
    feed_batch_text = nullif(btrim(coalesce(p_feed_batch_text, '')), ''),
    is_locked = true,
    updated_by = v_user,
    reversed_at = null,
    reversed_by = null,
    reversal_reason = null
  where brd_fc_line.id = p_line_id
    and brd_fc_line.void = '1';

  for v_allocation in
    select
      allocation.ordinality::integer as line_no,
      nullif(allocation.value->>'itemCode', '') as item_code,
      nullif(allocation.value->>'itemName', '') as item_name,
      nullif(allocation.value->>'batchNumber', '') as batch_no,
      nullif(allocation.value->>'warehouseCode', '') as whse_code,
      nullif(allocation.value->>'warehouseName', '') as whse_name,
      nullif(allocation.value->>'source', '') as source,
      nullif(allocation.value->>'manufacturingDate', '') as mfg_date,
      nullif(allocation.value->>'expiryDate', '') as exp_date,
      nullif(allocation.value->>'itemId', '')::bigint as item_id,
      nullif(allocation.value->>'warehouseId', '')::bigint as whse_id,
      coalesce(nullif(allocation.value->>'allocatedQty', '')::numeric, 0) as alloc_qty,
      coalesce(nullif(allocation.value->>'onHandSnapshot', '')::numeric, 0) as onhand_snapshot
    from jsonb_array_elements(coalesce(p_allocations, '[]'::jsonb)) with ordinality as allocation(value, ordinality)
  loop
    if v_allocation.item_code is null then
      raise exception 'Unable to save feed intake: item_code is required';
    end if;

    if v_allocation.whse_code is null then
      raise exception 'Unable to save feed intake: warehouse is required';
    end if;

    if v_allocation.batch_no is null then
      raise exception 'Unable to save feed intake: batch_no is required';
    end if;

    if coalesce(v_allocation.alloc_qty, 0) <= 0 then
      raise exception 'Unable to save feed intake: allocation quantity must be greater than zero';
    end if;

    select coalesce(sum(case when ip.transfer_type = 'OUT' then -ip.qty else ip.qty end), 0)
    into v_on_hand
    from public.inventory_postings ip
    where ip.item_code = v_allocation.item_code
      and ip.warehouse_code = v_allocation.whse_code
      and ip.ref is not distinct from v_allocation.batch_no;

    if v_allocation.alloc_qty > v_on_hand then
      raise exception 'Flock card feed usage exceeds on-hand inventory for item %, batch %, warehouse %.',
        v_allocation.item_code, v_allocation.batch_no, v_allocation.whse_code;
    end if;

    insert into public.brd_fc_ba (
      created_by,
      updated_by,
      fc_line_id,
      line_no,
      item_id,
      item_code,
      item_name,
      batch_no,
      whse_id,
      whse_code,
      whse_name,
      alloc_qty,
      onhand_snapshot,
      mfg_date,
      exp_date,
      source,
      void
    )
    values (
      v_user,
      v_user,
      p_line_id,
      v_allocation.line_no,
      v_allocation.item_id,
      v_allocation.item_code,
      v_allocation.item_name,
      v_allocation.batch_no,
      v_allocation.whse_id,
      v_allocation.whse_code,
      v_allocation.whse_name,
      v_allocation.alloc_qty,
      greatest(v_allocation.onhand_snapshot, v_on_hand),
      v_allocation.mfg_date::date,
      v_allocation.exp_date::date,
      coalesce(nullif(v_allocation.source, ''), 'MANUAL'),
      '1'
    )
    returning public.brd_fc_ba.id into v_ba_id;

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
      v_ba_id,
      v_allocation.item_code,
      v_allocation.whse_code,
      'MAIN SUB BIN',
      v_allocation.alloc_qty,
      v_user,
      'batch_code',
      v_allocation.batch_no,
      'OUT',
      'FLOCK_CARD',
      v_card.fc_no
    );
  end loop;

  select count(*)::integer
  into v_saved_allocation_count
  from public.brd_fc_ba ba
  where ba.fc_line_id = p_line_id
    and ba.void = '1';

  if v_saved_allocation_count <> v_expected_allocation_count then
    raise exception 'Unable to save feed intake: expected % feed batch allocations but saved %.',
      v_expected_allocation_count, v_saved_allocation_count;
  end if;

  return query
  select public.brd_fc_line.id, public.brd_fc_line.age
  from public.brd_fc_line
  where public.brd_fc_line.id = p_line_id;
end;
$$;

drop trigger if exists post_brd_fc_feed_inventory_insert on public.brd_fc_ba;

drop trigger if exists post_brd_fc_feed_inventory_void on public.brd_fc_ba;

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
