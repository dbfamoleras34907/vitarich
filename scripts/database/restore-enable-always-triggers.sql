do $$
declare
    trigger_row record;
begin
    for trigger_row in
        select relation_oid, trigger_name
        from codex_restore_always_trigger_modes
    loop
        execute format(
            'alter table %s enable always trigger %I',
            trigger_row.relation_oid::regclass,
            trigger_row.trigger_name
        );
    end loop;
end;
$$;
