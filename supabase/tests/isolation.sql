-- Run after migration in a disposable Supabase project as postgres.
-- Fixtures and helper functions are always rolled back on success.
begin;
insert into auth.users(id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002');
insert into public.surf_spots(id, user_id, name) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Test A'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'Test B');
insert into public.surf_sessions(id, user_id, spot_id, started_at, ended_at)
select '20000000-0000-4000-8000-000000000002', user_id, id, '2026-11-01T00:00:00Z', '2026-11-01T01:00:00Z'
from public.surf_spots where name = 'Test B' and id = '10000000-0000-4000-8000-000000000002';

create function pg_temp.expect_error(statement text, expected text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected then return; end if;
    raise;
  end;
  raise exception 'Expected SQLSTATE %, but statement succeeded', expected;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

do $$
declare affected integer;
begin
  if (select count(*) from public.surf_spots) <> 1 then raise exception 'Spot visibility leak'; end if;
  if exists(select 1 from public.surf_sessions) then raise exception 'Session visibility leak'; end if;
  update public.surf_spots set name = 'Forbidden' where id = '10000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-user spot update'; end if;
  delete from public.surf_spots where id = '10000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-user spot delete'; end if;
  update public.surf_sessions set notes = 'Forbidden' where id = '20000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-user session update'; end if;
  delete from public.surf_sessions where id = '20000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-user session delete'; end if;
end;
$$;

select pg_temp.expect_error(
  $$insert into public.surf_spots(user_id,name) values ('00000000-0000-4000-8000-000000000002','Forbidden')$$, '42501');
select pg_temp.expect_error(
  $$insert into public.surf_sessions(user_id,spot_id,started_at,ended_at) values
  ('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','2026-11-01T00:00:00Z','2026-11-01T01:00:00Z')$$, '42501');
select pg_temp.expect_error(
  $$update public.surf_spots set user_id = '00000000-0000-4000-8000-000000000002'$$, '42501');
select pg_temp.expect_error(
  $$insert into public.surf_sessions(user_id,spot_id,started_at,ended_at) values
  ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','2026-11-01T00:00:00Z','2026-11-01T01:00:00Z')$$, '23503');

insert into public.surf_sessions(user_id,spot_id,started_at,ended_at)
select '00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
  '2026-11-01T00:00:00Z'::timestamptz,'2026-11-01T01:00:00Z'::timestamptz
from generate_series(1,2);
select pg_temp.expect_error(
  $$update public.surf_sessions set user_id = '00000000-0000-4000-8000-000000000002'$$, '42501');
select pg_temp.expect_error(
  $$update public.surf_sessions set spot_id = '10000000-0000-4000-8000-000000000002'$$, '23503');
select pg_temp.expect_error($$update public.surf_sessions set ended_at = started_at$$, '23514');
select pg_temp.expect_error($$update public.surf_sessions set wave_rating = 6$$, '23514');
select pg_temp.expect_error($$update public.surf_sessions set overall_rating = 0$$, '23514');
select pg_temp.expect_error($$update public.surf_sessions set performance_rating = 6$$, '23514');
select pg_temp.expect_error($$update public.surf_sessions set crowd_level = 0$$, '23514');
select pg_temp.expect_error($$update public.surf_sessions set started_at = null$$, '23502');
select pg_temp.expect_error($$update public.surf_sessions set ended_at = null$$, '23502');
select pg_temp.expect_error($$update public.surf_spots set latitude = 91$$, '23514');
select pg_temp.expect_error($$update public.surf_spots set longitude = -181$$, '23514');
select pg_temp.expect_error($$delete from public.surf_spots$$, '23503');
update public.surf_sessions set wave_rating = 4, notes = 'Own update';
delete from public.surf_sessions;
delete from public.surf_spots;

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.expect_error($$select * from public.surf_spots$$, '42501');
select pg_temp.expect_error($$select * from public.surf_sessions$$, '42501');
select pg_temp.expect_error($$insert into public.surf_spots(user_id,name) values ('00000000-0000-4000-8000-000000000001','Forbidden')$$, '42501');
select pg_temp.expect_error($$insert into public.surf_sessions(user_id,spot_id,started_at,ended_at) values
  ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','2026-11-01T00:00:00Z','2026-11-01T01:00:00Z')$$, '42501');
select pg_temp.expect_error($$update public.surf_spots set name = 'Forbidden'$$, '42501');
select pg_temp.expect_error($$update public.surf_sessions set notes = 'Forbidden'$$, '42501');
select pg_temp.expect_error($$delete from public.surf_spots$$, '42501');
select pg_temp.expect_error($$delete from public.surf_sessions$$, '42501');
reset role;
rollback;
