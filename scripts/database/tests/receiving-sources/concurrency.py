"""Run only against the disposable loopback database after the SQL assertions."""
import subprocess
import sys

database = sys.argv[1]
if not database.startswith('receiving_sources_test'):
    raise SystemExit('Only a disposable receiving_sources_test database is allowed.')
command = ['psql', '-X', '-h', '127.0.0.1', '-p', '55438', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-q', '-c']
processes = []
for index in (1, 2):
    sql = f"""
      begin;
      select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
      select id from public.dispatch_doc where id=1 for update;
      select pg_sleep(0.5);
      select public.save_doc_receiving_with_sources(public.test_doc_payload(10,'CONCURRENT-{index}'),
        '00000000-0000-0000-0000-00000000040{index}');
      commit;
    """
    processes.append(subprocess.Popen(command + [sql], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True))
results = [(process.communicate(), process.returncode) for process in processes]
assert sorted(code for _, code in results) == [0, 1], results
assert any('remaining' in error for (_, error), code in results if code), results
check = subprocess.run(command + ["""
  do $$ begin
    if (select count(*) from public.goods_receipt where gr_no like 'CONCURRENT-%')<>1 then raise exception 'Concurrent receipt count is incorrect'; end if;
    if (select sum(a.quantity) from public.receiving_source_links a join public.goods_receipt_doc d on d.id=a.doc_detail_id join public.goods_receipt r on r.id=d.goods_reciept_id where a.doc_dispatch_line_id=1 and d.void='1' and r.status='Posted')<>100 then raise exception 'Concurrent source balance is incorrect'; end if;
  end $$;
"""], capture_output=True, text=True)
assert check.returncode == 0, check.stderr
print('Concurrent receiving: one commit, one rejected allocation; source balance = 100.')
