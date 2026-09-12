from pathlib import Path
import sys
source = Path("app/admin/notifications/notification_system.sql").read_text()
# Use the actual centralized schema and dispatcher, excluding unrelated business triggers.
header = source[:source.index("-- Source verification in the dispatcher")]
start = source.index("create or replace function public.process_notification_outbox")
end = source.index("create or replace function public.claim_notification_email_deliveries", start)
Path(sys.argv[1]).write_text(header + "\n" + source[start:end])
