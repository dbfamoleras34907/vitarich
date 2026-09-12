-- Disposable local database only; simplified auth and business tables, not production RLS.
create role authenticated;
create role anon;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select '11111111-1111-1111-1111-111111111111'::uuid$$;
insert into auth.users values(auth.uid()), ('22222222-2222-2222-2222-222222222222');
create table farms(id bigint primary key, code text, name text, farm_type text);
insert into farms values (1,'F1','Farm 1','BR'),(2,'F2','Farm 2','BR');
create table i_warehouse(id bigint primary key);
create table items(id bigint primary key, item_code text, item_name text);
insert into items values (1,'DOC','DOC');
create table batch_rules(id bigint primary key);
create table flock_card(id bigint primary key, card_no text, farm_id bigint, building_whse_id bigint, building_code text, building_name text, cycle_no text, start_date date, status text, void text, updated_by uuid, updated_at timestamptz, extra jsonb);
create table flock_card_origin(fc_id bigint, item_code text, batch_no text, void text);
create table brd_fc(id bigint primary key, card_no text, farm_id bigint, void text);
create table brd_fc_line(fc_id bigint, age integer, mort_am numeric, mort_pm numeric, void text);
create table inventory_postings(id bigint generated always as identity primary key, source_doc_type text, source_docentry bigint, item_code text, warehouse_code text, bin_code text, qty numeric, created_by uuid, ref_type text, ref text, batch_number text, transfer_type text, ref_type2 text, ref2 text);
create table br_delivery(id bigint primary key, farm_id bigint, status text, issue_date date);
create table users(id bigint primary key, auth_id uuid, firstname text, lastname text, user_type integer, fms_type text, users_group_id bigint, isactive text, email text);
create table users_farms(users_id bigint, farm_id bigint, farm_code text, void text);
create table user_permissions(user_id uuid, group_name text, title text, is_visible boolean);
insert into users values(1,'22222222-2222-2222-2222-222222222222','Test','Recipient',3,'Broiler',null,'1','test@example.test');
insert into users_farms values(1,1,'F1','1');
insert into user_permissions values('22222222-2222-2222-2222-222222222222','Menus','Clean up/view',true);

do $$begin
  for n in 1..12 loop
    insert into i_warehouse values(n);
    insert into flock_card values(n,'FC'||n,1,n,'B'||n,'Building '||n,'1','2026-08-01','Saved','1',null,null,null);
    insert into flock_card_origin values(n,'DOC','ORIGIN'||n,'1');
    insert into brd_fc values(n,'FC'||n,1,'1');
    insert into brd_fc_line values(n,40,1,0,'1');
    insert into inventory_postings(source_doc_type,source_docentry,item_code,warehouse_code,qty,batch_number,transfer_type)
      values('DOC_RECEIVING_CONSOLIDATION',n,'DOC','B'||n,100,'DOC:F1:B'||n||':1','IN');
    insert into br_delivery values(n,1,'Posted','2026-09-01');
  end loop;
end;$$;

create function test_cleanup_document(n integer, quantity numeric, state text default 'Posted') returns jsonb language sql as $$
  select jsonb_build_object('giNo','CU-TEST-'||n,'issueDate','2026-09-12','farmId',1,
    'farmCode','UNTRUSTED','status',state,'lines',jsonb_build_array(jsonb_build_object(
      'itemId',1,'itemCode','DOC','description','DOC','batchNumber','DOC:F1:B'||n||':1',
      'fromWarehouseId',n,'fromWarehouseCode','B'||n,'altQty',quantity,'baseQty',quantity,
      'altUom','HEAD','baseUom','HEAD','batchTotalQty',quantity,'varianceQty',0)));
$$;
create function test_assert(ok boolean, message text) returns void language plpgsql as $$begin
  if not coalesce(ok,false) then raise exception 'Assertion failed: %', message; end if;
end;$$;
