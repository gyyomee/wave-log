begin;
create table public.surf_session_marine_samples (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.surf_sessions(id) on delete cascade,
 sampled_at timestamptz not null check (isfinite(sampled_at) and mod(extract(epoch from sampled_at), 3600) = 0),
 wave_height numeric check (wave_height >= 0 and wave_height < 'Infinity'::numeric),
 wave_period numeric check (wave_period >= 0 and wave_period < 'Infinity'::numeric),
 wave_direction numeric check (wave_direction >= 0 and wave_direction <= 360),
 swell_height numeric check (swell_height >= 0 and swell_height < 'Infinity'::numeric),
 swell_period numeric check (swell_period >= 0 and swell_period < 'Infinity'::numeric),
 swell_direction numeric check (swell_direction >= 0 and swell_direction <= 360),
 swell_peak_period numeric check (swell_peak_period >= 0 and swell_peak_period < 'Infinity'::numeric),
 wind_wave_height numeric check (wind_wave_height >= 0 and wind_wave_height < 'Infinity'::numeric),
 wind_wave_period numeric check (wind_wave_period >= 0 and wind_wave_period < 'Infinity'::numeric),
 wind_wave_direction numeric check (wind_wave_direction >= 0 and wind_wave_direction <= 360),
 data_provider text not null check (data_provider = 'open-meteo'),
 data_model text not null,
 data_source_type text not null check (data_source_type in ('forecast','archived_forecast','historical_model')),
 requested_latitude numeric not null check (requested_latitude between -90 and 90),
 requested_longitude numeric not null check (requested_longitude between -180 and 180),
 model_latitude numeric check (model_latitude between -90 and 90),
 model_longitude numeric check (model_longitude between -180 and 180),
 spot_id uuid not null,
 session_started_at timestamptz not null,
 session_ended_at timestamptz not null,
 fetched_at timestamptz not null default now(),
 unique(session_id, sampled_at),
 check (sampled_at >= session_started_at and sampled_at < session_ended_at)
);
alter table public.surf_session_marine_samples enable row level security;
revoke all on public.surf_session_marine_samples from public, anon, authenticated;
grant select, insert, update, delete on public.surf_session_marine_samples to authenticated;
create policy marine_select on public.surf_session_marine_samples for select to authenticated using (exists (select 1 from public.surf_sessions s where s.id = session_id and s.user_id = (select auth.uid()))) ;
create policy marine_insert on public.surf_session_marine_samples for insert to authenticated  with check (exists (select 1 from public.surf_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
create policy marine_update on public.surf_session_marine_samples for update to authenticated using (exists (select 1 from public.surf_sessions s where s.id = session_id and s.user_id = (select auth.uid()))) with check (exists (select 1 from public.surf_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
create policy marine_delete on public.surf_session_marine_samples for delete to authenticated using (exists (select 1 from public.surf_sessions s where s.id = session_id and s.user_id = (select auth.uid()))) ;

-- Atomic refresh: any error rolls back the deletion. Invoker RLS remains active.
create function public.replace_session_marine(target_session uuid, samples jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
 perform 1 from public.surf_sessions where id = target_session and user_id = auth.uid() for update;
 if not found then raise exception 'Session not accessible' using errcode = '42501'; end if;
 if jsonb_typeof(samples) <> 'array' or jsonb_array_length(samples) = 0 then
   raise exception 'Nonempty sample array required';
 end if;
 if exists (select 1 from jsonb_array_elements(samples) x where (x->>'session_id')::uuid is distinct from target_session) then
   raise exception 'Session mismatch';
 end if;
 delete from public.surf_session_marine_samples where session_id = target_session;
 insert into public.surf_session_marine_samples
 select (jsonb_populate_record(null::public.surf_session_marine_samples, x || jsonb_build_object('id', gen_random_uuid()))).*
 from jsonb_array_elements(samples) x;
end;
$$;
revoke all on function public.replace_session_marine(uuid,jsonb) from public, anon;
grant execute on function public.replace_session_marine(uuid,jsonb) to authenticated;
commit;
