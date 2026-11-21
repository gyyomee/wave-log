-- Read-only checks. Run in SQL Editor after deployment.
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('surf_spots', 'surf_sessions');

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('surf_spots', 'surf_sessions')
order by tablename, cmd;

select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (to_regclass('public.surf_spots'), to_regclass('public.surf_sessions'))
order by table_name, conname;

select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name in ('surf_spots', 'surf_sessions')
order by table_name, ordinal_position;

select table_name, grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public' and table_name in ('surf_spots', 'surf_sessions')
order by table_name, grantee, privilege_type;

select tablename, indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename in ('surf_spots', 'surf_sessions');

select event_object_table, trigger_name, action_statement
from information_schema.triggers
where event_object_schema = 'public' and event_object_table in ('surf_spots', 'surf_sessions');
