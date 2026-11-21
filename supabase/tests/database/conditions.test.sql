begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(5);
insert into auth.users(id) values ('00000000-0000-4000-a000-000000000001');
insert into public.surf_spots(id,user_id,name) values ('10000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000001','Conditions test');
insert into public.surf_sessions(id,user_id,spot_id,started_at,ended_at) values
('20000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000001','10000000-0000-4000-a000-000000000001','2025-06-01T00:00Z','2025-06-01T01:00Z');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-a000-000000000001',true);
insert into public.surf_session_conditions(session_id,wind_direction,air_temperature)
values ('20000000-0000-4000-a000-000000000001',44.7,-2);
select is((select count(*) from public.surf_session_conditions),1::bigint,'Owner can insert and read');
select throws_ok($$update public.surf_session_conditions set wind_direction=361$$,'23514',null,'Direction range enforced');
select set_config('request.jwt.claim.sub','00000000-0000-4000-a000-000000000002',true);
select is((select count(*) from public.surf_session_conditions),0::bigint,'Other user cannot read');
select throws_ok($$insert into public.surf_session_conditions(session_id) values ('20000000-0000-4000-a000-000000000001')$$,'42501',null,'Other user cannot attach conditions');
select set_config('request.jwt.claim.sub','00000000-0000-4000-a000-000000000001',true);
delete from public.surf_sessions where id='20000000-0000-4000-a000-000000000001';
select is((select count(*) from public.surf_session_conditions),0::bigint,'Parent deletion cascades');
reset role;
select * from finish();
rollback;
