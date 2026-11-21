do $$ begin
 if (select count(*) from public.surf_sessions where id='54200000-0000-4000-a000-000000000001') <> 1 then raise exception 'Real session lost'; end if;
 if (select jsonb_array_length(condition_intervals) from public.surf_session_conditions where session_id='54200000-0000-4000-a000-000000000001') <> 2 then raise exception 'Manual/uncertain preservation failed'; end if;
 if (select wave_height from public.surf_session_conditions where session_id='54200000-0000-4000-a000-000000000001') <> 4 then raise exception 'Session manual value lost'; end if;
 if (select jsonb_array_length(condition_hourly) from public.surf_session_conditions where session_id='54200000-0000-4000-a000-000000000001') <> 1 then raise exception 'Source deduplication failed'; end if;
 if (select count(*) from public.surf_session_marine_samples where session_id='54200000-0000-4000-a000-000000000001') <> 1 then raise exception 'Relevant sample pruning failed'; end if;
 if (select count(*) from wave_log_cleanup.backups where batch=(select id from cleanup_batch)) <> 2 then raise exception 'Backup incomplete'; end if;
end $$;
