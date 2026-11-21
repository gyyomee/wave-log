begin;
create table public.surf_session_conditions (
 session_id uuid primary key references public.surf_sessions(id) on delete cascade,
 wave_height numeric check (wave_height between 0 and 50),
 wave_period numeric check (wave_period between 0 and 100),
 swell_height numeric check (swell_height between 0 and 50),
 swell_period numeric check (swell_period between 0 and 100),
 swell_direction numeric check (swell_direction between 0 and 360),
 wind_speed numeric check (wind_speed between 0 and 150),
 wind_direction numeric check (wind_direction between 0 and 360),
 water_temperature numeric check (water_temperature between -10 and 50),
 air_temperature numeric check (air_temperature between -100 and 70),
 wetsuit text,
 api_values jsonb not null default '{}'::jsonb check (jsonb_typeof(api_values) = 'object'),
 manual_origins jsonb not null default '{}'::jsonb check (jsonb_typeof(manual_origins) = 'object'),
 manual_fields text[] not null default '{}' check (manual_fields <@ array['wave_height','wave_period','swell_height','swell_period','swell_direction','wind_speed','wind_direction','water_temperature','air_temperature']),
 rating_intent jsonb not null default '{}'::jsonb check (
   jsonb_typeof(rating_intent) = 'object'
   and rating_intent - 'overall_rating' - 'wave_rating' - 'crowd_level' = '{}'::jsonb
   and (not rating_intent ? 'overall_rating' or rating_intent->>'overall_rating' in ('default','confirmed','modified','legacy'))
   and (not rating_intent ? 'wave_rating' or rating_intent->>'wave_rating' in ('default','confirmed','modified','legacy'))
   and (not rating_intent ? 'crowd_level' or rating_intent->>'crowd_level' in ('default','confirmed','modified','legacy'))
 ),
 context text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create trigger session_conditions_updated_at before update on public.surf_session_conditions
for each row execute function public.wave_log_set_updated_at();
alter table public.surf_session_conditions enable row level security;
revoke all on public.surf_session_conditions from public, anon, authenticated;
grant select, insert, update, delete on public.surf_session_conditions to authenticated;
create policy conditions_select on public.surf_session_conditions for select to authenticated using (exists (select 1 from public.surf_sessions s where s.id = session_id and s.user_id = (select auth.uid()))) ;
create policy conditions_insert on public.surf_session_conditions for insert to authenticated  with check (exists (select 1 from public.surf_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
create policy conditions_update on public.surf_session_conditions for update to authenticated using (exists (select 1 from public.surf_sessions s where s.id = session_id and s.user_id = (select auth.uid()))) with check (exists (select 1 from public.surf_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
create policy conditions_delete on public.surf_session_conditions for delete to authenticated using (exists (select 1 from public.surf_sessions s where s.id = session_id and s.user_id = (select auth.uid()))) ;
commit;
