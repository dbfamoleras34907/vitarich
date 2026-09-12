"""Generate TEST-ONLY SQL from checked-in schema/functions, for an empty local DB.

From repository root: python scripts/database/tests/growing-reversal/prepare_fixture.py
Then psql -v ON_ERROR_STOP=1 against a disposable DB, with these files in order:
tmp/full-reversal-fixture.sql, app/brd/fc/reverse_brd_fc_transaction.sql,
scripts/database/tests/growing-reversal/assertions.sql.
"""
from pathlib import Path


def function(source, name):
    start = source.index('create or replace function public.' + name + '(')
    return source[start:source.index('$$;', start) + 3] + '\n'


fixture = Path('scripts/database/tests/growing-transaction/fixture.sql').read_text()
fixture = fixture[:fixture.index('-- Probe trigger')]
fixture = '\n'.join(line for line in fixture.splitlines() if not line.startswith('create table notification_outbox'))
fixture += """
do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; end;$$;
create table users(id bigint primary key, auth_id uuid, user_type integer, firstname text, lastname text, email text, fms_type text, users_group_id bigint, isactive text);
insert into users values(1,auth.uid(),1,'Test','Admin','test@example.test','Broiler',null,'1');
create table users_farms(users_id bigint, farm_id bigint, farm_code text, void text);
create table user_permissions(user_id uuid, group_name text, title text, is_visible boolean);
alter table i_warehouse add column whse_code text, add column farm_id bigint, add column is_default_disposal_warehouse boolean;
insert into i_warehouse values(10,'B1',61,false),(11,'DISPOSAL',61,true);
"""
notifications = Path('app/admin/notifications/notification_system.sql').read_text()
fixture += notifications[:notifications.index('alter table public.notification_rules enable row level security;')]
placement = Path('app/brd/fc/flock_card_tables.sql').read_text()
fixture += placement[:placement.index('alter table public.flock_card')]
fixture += 'create table flock_card_origin(id bigint, fc_id bigint, item_code text, batch_no text, animal_qty numeric, void text);\n'
for name in ['br_delivery', 'br_cleanup']:
    fixture += f'create table {name}(id bigint primary key, farm_id bigint, status text, from_warehouse_id bigint, from_warehouse_code text);\n'
    fixture += f'create table {name}_lines(id bigint primary key, {name}_id bigint, from_warehouse_id bigint, from_warehouse_code text, item_code text, batch_number text, void text);\n'
schema = Path('app/brd/fc/new/flock_card_tables.sql').read_text()
for name in ['reverse_brd_fc_feed_intake', 'reverse_brd_fc_mortality_thinning',
             'post_brd_fc_mortality_thinning_inventory', 'enforce_brd_fc_reverse_order', 'sync_brd_fc_actual_age']:
    fixture += function(schema, name)
fixture += """
create trigger reverse_order before update on brd_fc_line for each row execute function enforce_brd_fc_reverse_order();
create trigger sync_age after insert or delete or update on brd_fc_line for each row execute function sync_brd_fc_actual_age();
create trigger mortality_update after update on brd_fc_line for each row execute function post_brd_fc_mortality_thinning_inventory();
"""
save = Path('app/brd/fc/new/save_brd_fc_transaction.sql').read_text()
fixture += function(save, 'enqueue_brd_fc_reversal_event')
fixture += 'create trigger brd_fc_reversal_event after update on brd_fc_line for each row execute function enqueue_brd_fc_reversal_event();\n'
Path('tmp/full-reversal-fixture.sql').write_text(fixture)
