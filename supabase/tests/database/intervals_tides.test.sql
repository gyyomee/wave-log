begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(13);
insert into auth.users(id) values ('53000000-0000-4000-a000-000000000001');
insert into public.surf_spots(id,user_id,name) values ('53100000-0000-4000-a000-000000000001','53000000-0000-4000-a000-000000000001','Interval test');
insert into public.surf_sessions(id,user_id,spot_id,started_at,ended_at) values
('53200000-0000-4000-a000-000000000001','53000000-0000-4000-a000-000000000001','53100000-0000-4000-a000-000000000001','2026-10-01T00:00Z','2026-10-01T08:00Z');
set local role authenticated;
select set_config('request.jwt.claim.sub','53000000-0000-4000-a000-000000000001',true);
select lives_ok($$insert into public.surf_session_conditions(session_id,condition_intervals,tide_cycle_label,tide_convention)
values ('53200000-0000-4000-a000-000000000001',
'[{"id":"one","started_at":"2026-10-01T00:00:00Z","ended_at":"2026-10-01T03:00:00Z","wave_height":0,"api_values":{},"manual_fields":["wave_height"]}]',
'지역 이름','8')$$,'Owner can save intervals and regional tide label');
select is((select condition_intervals->0->>'wave_height' from public.surf_session_conditions where session_id='53200000-0000-4000-a000-000000000001'),'0','Zero survives storage');
select throws_ok($$update public.surf_session_conditions set condition_intervals=jsonb_set(condition_intervals,'{0,ended_at}','"2026-10-01T04:00:00Z"') where session_id='53200000-0000-4000-a000-000000000001'$$,'23514',null,'More than three hours rejected');
select throws_ok($$update public.surf_session_conditions set condition_intervals=jsonb_set(condition_intervals,'{0,wave_height}','51') where session_id='53200000-0000-4000-a000-000000000001'$$,'23514',null,'Wave range checked');
select throws_ok($$update public.surf_session_conditions set tide_events='[{"id":"bad","type":"high","date":"2026-10-01","time":"24:00","timezone":"Asia/Seoul","source":"manual","occurred_at":"2026-10-01T15:00:00Z"}]' where session_id='53200000-0000-4000-a000-000000000001'$$,'23514',null,'Invalid 24-hour time rejected');
select lives_ok($$update public.surf_session_conditions set tide_events=(select jsonb_agg(jsonb_build_object('id',n::text,'type',case when n%2=0 then 'low' else 'high' end,'date','2026-10-02','time','00:30','timezone','Asia/Seoul','source','manual','height_cm',null,'occurred_at','2026-10-01T15:30:00Z')) from generate_series(1,6) n) where session_id='53200000-0000-4000-a000-000000000001'$$,'Multiple adjacent-date tides with nullable heights');
select is((select jsonb_array_length(tide_events) from public.surf_session_conditions where session_id='53200000-0000-4000-a000-000000000001'),6,'No two-event assumption');
select throws_ok($$update public.surf_session_conditions set tide_convention='9' where session_id='53200000-0000-4000-a000-000000000001'$$,'23514',null,'Unsupported convention rejected');
select set_config('request.jwt.claim.sub','53000000-0000-4000-a000-000000000002',true);
select is((select count(*) from public.surf_session_conditions where session_id='53200000-0000-4000-a000-000000000001'),0::bigint,'Other user cannot read');
with changed as (update public.surf_session_conditions set tide_cycle_label='stolen' where session_id='53200000-0000-4000-a000-000000000001' returning *) select is((select count(*) from changed),0::bigint,'Other user cannot update');
select throws_ok($$insert into public.surf_session_conditions(session_id) values ('53200000-0000-4000-a000-000000000001')$$,'42501',null,'Other user cannot attach data');
set local role anon;
select throws_ok($$select * from public.surf_session_conditions$$,'42501',null,'Anonymous access denied');
set local role authenticated;
select set_config('request.jwt.claim.sub','53000000-0000-4000-a000-000000000001',true);
delete from public.surf_sessions where id='53200000-0000-4000-a000-000000000001';
select is((select count(*) from public.surf_session_conditions where session_id='53200000-0000-4000-a000-000000000001'),0::bigint,'Cascade removes only test session conditions');
reset role;
select * from finish();
rollback;
