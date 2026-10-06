-- Apply only to the disposable cleanup-zero fixture database.
alter table user_permissions add column ilink text;
alter table flock_card add column farm_cycle_id bigint;
create table doc_farm_cycles(id bigint primary key, farm_id bigint, cycle_no bigint, status text, closed_at timestamptz, updated_by uuid, updated_at timestamptz);
alter table br_delivery add column created_at timestamptz default '2026-08-01';
alter table br_delivery add column updated_at timestamptz;
alter table br_delivery add column from_warehouse_id bigint;
alter table br_delivery add column from_warehouse_code text;
create table br_delivery_lines(br_delivery_id bigint, from_warehouse_id bigint, from_warehouse_code text, void text, created_at timestamptz, updated_at timestamptz);
alter table brd_fc add column building_whse_id bigint;
alter table brd_fc add column created_at timestamptz default '2026-08-01';
alter table brd_fc add column updated_at timestamptz;
alter table brd_fc_line add column created_at timestamptz default '2026-08-01';
alter table brd_fc_line add column updated_at timestamptz;
create table goods_receipt_doc(flock_card_id bigint, building_warehouse_id bigint, void text, created_at timestamptz, updated_at timestamptz);
