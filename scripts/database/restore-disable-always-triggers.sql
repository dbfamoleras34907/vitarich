create temporary table codex_restore_always_trigger_modes (
    relation_oid oid not null,
    trigger_name name not null,
    primary key (relation_oid, trigger_name)
) on commit drop;

insert into codex_restore_always_trigger_modes (relation_oid, trigger_name)
select trigger_row.tgrelid, trigger_row.tgname
from pg_catalog.pg_trigger as trigger_row
join pg_catalog.pg_class as relation_row
  on relation_row.oid = trigger_row.tgrelid
join pg_catalog.pg_namespace as schema_row
  on schema_row.oid = relation_row.relnamespace
where not trigger_row.tgisinternal
  and trigger_row.tgenabled = 'A'
  and schema_row.nspname = 'public';

do $$
declare
    trigger_row record;
begin
    for trigger_row in
        select relation_oid, trigger_name
        from codex_restore_always_trigger_modes
    loop
        execute format(
            'alter table %s disable trigger %I',
            trigger_row.relation_oid::regclass,
            trigger_row.trigger_name
        );
    end loop;
end;
$$;
