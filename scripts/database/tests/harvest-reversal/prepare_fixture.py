"""Build a disposable fixture with the actual Harvest DDL and posting triggers."""
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[4]
out = Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
harvest = (root / 'app/brd/dr/br_delivery_tables.sql').read_text(encoding='utf-8')
base = (root / 'scripts/database/tests/cleanup-zero/fixture.sql').read_text(encoding='utf-8')
for role in ['authenticated', 'anon']:
    base = base.replace(f'create role {role};', f'do $$begin create role {role}; exception when duplicate_object then null; end;$$;')
ddl = '\n'.join(re.search(r'create table if not exists public\.' + name + r' \([\s\S]*?\n\);', harvest)[0]
                for name in ['br_delivery', 'br_delivery_lines'])
base = re.sub(r'create table br_delivery\([^\n]*;', ddl, base)
base = base.replace("insert into br_delivery values(n,1,'Posted','2026-09-01');",
    "insert into br_delivery(id,gi_no,farm_id,status,issue_date) overriding system value values(n,'SEED-'||n,1,'Posted','2026-09-01');")
extra = (root / 'scripts/database/tests/cleanup-zero/reversal-fixture.sql').read_text(encoding='utf-8')
extra = '\n'.join(line for line in extra.splitlines() if not line.startswith(('alter table br_delivery ', 'create table br_delivery_lines(')))
base += '\n' + extra + "\nalter table brd_fc add column actual_age integer default 40;\nselect setval(pg_get_serial_sequence('br_delivery','id'),12);\n"
(out / 'fixture.sql').write_text(base, encoding='utf-8')
(out / 'harvest-posting.sql').write_text(harvest[harvest.index('create or replace function public.set_updated_at()'):], encoding='utf-8')
