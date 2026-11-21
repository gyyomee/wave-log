\set ON_ERROR_STOP on
begin;
-- Explicit IDs ONLY, after reviewing audit output and taking an external backup.
create temp table approved_sessions(id uuid primary key);
-- insert into approved_sessions values ('REVIEWED-SESSION-UUID');

lock table public.surf_sessions, public.surf_spots, public.surf_session_conditions, public.surf_session_marine_samples in share row exclusive mode;
\ir condition_cleanup_helpers.sql
create schema if not exists wave_log_cleanup;
revoke all on schema wave_log_cleanup from public,anon,authenticated;
create table if not exists wave_log_cleanup.backups(
 batch uuid not null, table_name text not null, row_id uuid not null,
 before_data jsonb not null, after_data jsonb, backed_up_at timestamptz default now(),
 primary key(batch,table_name,row_id)
);
revoke all on wave_log_cleanup.backups from public,anon,authenticated;
create temp table cleanup_batch as select gen_random_uuid() as id;
insert into wave_log_cleanup.backups(batch,table_name,row_id,before_data)
select b.id,'surf_session_conditions',c.session_id,to_jsonb(c)
from public.surf_session_conditions c join approved_sessions a on a.id=c.session_id
join cleanup_conditions x using(session_id) cross join cleanup_batch b
where c.condition_intervals is distinct from x.retained_intervals or c.condition_hourly is distinct from x.retained_sources;
insert into wave_log_cleanup.backups(batch,table_name,row_id,before_data)
select b.id,'surf_session_marine_samples',m.id,to_jsonb(m)
from public.surf_session_marine_samples m join cleanup_marine x on x.id=m.id
join approved_sessions a on a.id=m.session_id cross join cleanup_batch b;
update public.surf_session_conditions c
set condition_intervals=x.retained_intervals,condition_hourly=x.retained_sources
from cleanup_conditions x,approved_sessions a
where c.session_id=x.session_id and a.id=c.session_id
and (c.condition_intervals is distinct from x.retained_intervals or c.condition_hourly is distinct from x.retained_sources);
update wave_log_cleanup.backups b set after_data=to_jsonb(c)
from public.surf_session_conditions c,cleanup_batch batch
where b.batch=batch.id and b.table_name='surf_session_conditions' and b.row_id=c.session_id;
delete from public.surf_session_marine_samples m using cleanup_marine x,approved_sessions a
where m.id=x.id and a.id=m.session_id;
select b.batch,b.table_name,count(*) as affected_rows
from wave_log_cleanup.backups b join cleanup_batch batch on batch.id=b.batch group by b.batch,b.table_name;
-- Dry run by default. Change ONLY after checking counts and backups.
rollback;
