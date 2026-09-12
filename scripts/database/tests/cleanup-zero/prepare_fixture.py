"""Extract current notification DDL/dispatcher so tests use the actual shared implementation."""
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[4]
source = (root / 'app/admin/notifications/notification_system.sql').read_text()
tables = ['notification_rules', 'notification_outbox', 'user_notifications', 'notification_email_deliveries']
parts = []
for name in tables:
    parts.append(re.search(r'create table if not exists public\.' + name + r' \([\s\S]*?\n\);', source)[0])
parts.append("alter table public.notification_rules add column if not exists email_enabled boolean not null default false;")
parts.append(re.search(r'create or replace function public\.process_notification_outbox\([\s\S]*?\n\$\$;', source)[0])
Path(sys.argv[1]).write_text('\n'.join(parts))
