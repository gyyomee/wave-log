\set ON_ERROR_STOP on
begin;
\ir condition_cleanup_helpers.sql
select count(*) as real_sessions from public.surf_sessions;
select count(*) as condition_rows,
 coalesce(sum(jsonb_array_length(c.condition_intervals)-jsonb_array_length(x.retained_intervals)),0) as confirmed_automatic_interval_entries,
 count(*) filter (where c.condition_intervals is distinct from x.retained_intervals or c.condition_hourly is distinct from x.retained_sources) as candidate_condition_rows,
 count(*) filter (where jsonb_array_length(x.retained_intervals)>0) as rows_with_manual_or_uncertain_inputs
from public.surf_session_conditions c join cleanup_conditions x using(session_id);
select count(*) as raw_marine_rows from public.surf_session_marine_samples;
select count(*) as outside_current_forecast_range from cleanup_marine;
-- Session identifiers and counts, not private notes, API keys, or raw values.
select c.session_id,
 jsonb_array_length(c.condition_intervals)-jsonb_array_length(x.retained_intervals) as automatic_entries,
 jsonb_array_length(c.condition_hourly) as old_source_groups,
 jsonb_array_length(x.retained_sources) as retained_source_groups,
 (select count(*) from cleanup_marine m where m.session_id=c.session_id) as obsolete_marine_samples
from public.surf_session_conditions c join cleanup_conditions x using(session_id)
where c.condition_intervals is distinct from x.retained_intervals or c.condition_hourly is distinct from x.retained_sources
 or exists(select 1 from cleanup_marine m where m.session_id=c.session_id);
rollback;
