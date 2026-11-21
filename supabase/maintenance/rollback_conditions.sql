\set ON_ERROR_STOP on
begin;
-- Set a reviewed committed batch UUID. NULL restores nothing.
create temp table restore_batch as select null::uuid as id;
lock table public.surf_sessions,public.surf_session_conditions,public.surf_session_marine_samples in share row exclusive mode;
-- Abort instead of overwriting edits made since cleanup.
do $$ begin
 if exists(select 1 from wave_log_cleanup.backups b join restore_batch r on r.id=b.batch
   left join public.surf_session_conditions c on c.session_id=b.row_id
   where b.table_name='surf_session_conditions' and to_jsonb(c) is distinct from b.after_data)
 then raise exception 'Conditions changed since cleanup; manual merge required'; end if;
end $$;
update public.surf_session_conditions c set
 condition_intervals=b.before_data->'condition_intervals',
 condition_hourly=b.before_data->'condition_hourly'
from wave_log_cleanup.backups b,restore_batch r
where b.batch=r.id and b.table_name='surf_session_conditions' and c.session_id=b.row_id;
-- A newly occupied ID or session/timestamp causes an error and rolls back,
-- rather than silently overwriting a later observation.
insert into public.surf_session_marine_samples
select (jsonb_populate_record(null::public.surf_session_marine_samples,b.before_data)).*
from wave_log_cleanup.backups b join restore_batch r on r.id=b.batch
where b.table_name='surf_session_marine_samples';
rollback;
