begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
    function_oid regprocedure;
    current_body text;
    updated_body text;
    begin_position integer;
    restore_guard constant text :=
        E'begin\n\n  -- A logical restore already contains the original inventory postings.\n  -- Do not create a second set while data is loaded in replica mode.\n  if current_setting(''session_replication_role'') = ''replica'' then\n    return new;\n  end if;';
begin
    function_oid := to_regprocedure(
        'public.trg_post_inventory_from_chick_grading()'
    );

    if function_oid is null then
        raise exception
            'Expected function public.trg_post_inventory_from_chick_grading() was not found';
    end if;

    select procedure_row.prosrc
    into current_body
    from pg_catalog.pg_proc as procedure_row
    where procedure_row.oid = function_oid;

    if current_body like
       '%current_setting(''session_replication_role'') = ''replica''%' then
        return;
    end if;

    if current_body not like '%insert into public.inventory_postings%'
       or current_body not like '%auth.uid()%' then
        raise exception
            'Function body is not the expected Chick Grading inventory implementation';
    end if;

    begin_position := strpos(lower(current_body), 'begin');

    if begin_position = 0 then
        raise exception 'Could not locate the function BEGIN block';
    end if;

    updated_body := overlay(
        current_body
        placing restore_guard
        from begin_position
        for length('begin')
    );

    execute format(
        'create or replace function public.trg_post_inventory_from_chick_grading() '
        'returns trigger language plpgsql security definer as %L',
        updated_body
    );
end;
$migration$;

do $verification$
declare
    function_oid regprocedure;
    function_body text;
begin
    function_oid := to_regprocedure(
        'public.trg_post_inventory_from_chick_grading()'
    );

    select procedure_row.prosrc
    into function_body
    from pg_catalog.pg_proc as procedure_row
    where procedure_row.oid = function_oid;

    if function_body not like
       '%current_setting(''session_replication_role'') = ''replica''%' then
        raise exception 'Restore guard verification failed';
    end if;
end;
$verification$;

commit;

select
    procedure_row.oid::regprocedure as function_name,
    case
        when procedure_row.prosrc like
             '%current_setting(''session_replication_role'') = ''replica''%'
        then 'replica restore guard installed'
        else 'replica restore guard missing'
    end as restore_guard
from pg_catalog.pg_proc as procedure_row
where procedure_row.oid =
      to_regprocedure('public.trg_post_inventory_from_chick_grading()');
