begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(4);
insert into auth.users(id) values ('00000000-0000-4000-9000-000000000001');
insert into public.surf_spots(id,user_id,name) values ('10000000-0000-4000-9000-000000000001','00000000-0000-4000-9000-000000000001','Marine test');
insert into public.surf_sessions(id,user_id,spot_id,started_at,ended_at) values
('20000000-0000-4000-9000-000000000001','00000000-0000-4000-9000-000000000001','10000000-0000-4000-9000-000000000001','2025-06-01T00:00Z','2025-06-01T01:00Z');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000000001',true);
insert into public.surf_session_marine_samples(session_id,sampled_at,data_provider,data_model,data_source_type,requested_latitude,requested_longitude,spot_id,session_started_at,session_ended_at)
values ('20000000-0000-4000-9000-000000000001','2025-06-01T00:00Z','open-meteo','meteofrance_wave','archived_forecast',37.8,129,'10000000-0000-4000-9000-000000000001','2025-06-01T00:00Z','2025-06-01T01:00Z');
select is((select count(*) from public.surf_session_marine_samples),1::bigint,'Owner can read sample');
select throws_ok($$insert into public.surf_session_marine_samples select (jsonb_populate_record(null::public.surf_session_marine_samples, to_jsonb(s) || jsonb_build_object('id',gen_random_uuid()))).* from public.surf_session_marine_samples s$$,'23505',null,'Duplicate session/hour prevented independently of ID');
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000000002',true);
select is((select count(*) from public.surf_session_marine_samples),0::bigint,'Other user cannot read sample');
select set_config('request.jwt.claim.sub','00000000-0000-4000-9000-000000000001',true);
delete from public.surf_sessions where id='20000000-0000-4000-9000-000000000001';
select is((select count(*) from public.surf_session_marine_samples),0::bigint,'Session deletion cascades');
reset role;
select * from finish();
rollback;
