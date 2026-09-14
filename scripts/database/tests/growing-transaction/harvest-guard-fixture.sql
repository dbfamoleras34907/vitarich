-- Disposable database only, after fixture.sql and the save RPC assertions.
begin;
create table flock_card(id bigint primary key, farm_id bigint, card_no text,
  building_whse_id bigint, building_code text, cycle_no text, void text default '1');
create table flock_card_origin(fc_id bigint, item_code text, batch_no text, void text default '1');
create table br_delivery(id bigint primary key, farm_id bigint, gi_no text, status text,
  from_warehouse_id bigint, from_warehouse_code text);
create table br_delivery_lines(id bigint primary key, br_delivery_id bigint, item_code text,
  batch_number text, from_warehouse_id bigint, from_warehouse_code text, void text default '1');
insert into flock_card values (1,61,'CARD-1',6,'B1','1','1'),(2,61,'CARD-2',6,'B1','2','1');
-- Deliberately carried origin from cycle 1 into cycle 2.
insert into flock_card_origin values (2,'DOC','DOC:F61:B6:1','1'),(2,'DOC','LEGACY-2','1');
insert into i_warehouse(id) values(6) on conflict do nothing;
update brd_fc set card_no='CARD-2',building_whse_id=6,building_code='B1';
insert into br_delivery values
  (1,61,'OLD','Posted',6,'B1'),(2,61,'CURRENT','Draft',6,'B1'),
  (3,61,'OTHER-BUILDING','Posted',7,'B2'),(4,62,'OTHER-FARM','Posted',6,'B1'),
  (5,61,'SECOND','Cancelled',6,'B1');
insert into br_delivery_lines values
  (1,1,'DOC','DOC:F61:B6:1',6,'B1','1'),(2,2,'DOC','DOC:F61:B6:2',6,'B1','1'),
  (3,3,'DOC','DOC:F61:B6:2',7,'B2','1'),(4,4,'DOC','DOC:F61:B6:2',6,'B1','1'),
  (5,5,'DOC','LEGACY-2',6,'B1','1');
commit;
