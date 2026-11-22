// Optional integration check: local Supabase container only; transaction rolls back.
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
const args=['exec','-i','supabase_db_wave-log','psql','-X','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1']
const history=spawnSync('docker',args,{input:'select version from supabase_migrations.schema_migrations; select to_regclass(\'public.user_equipment\');',encoding:'utf8'})
if(history.status) throw new Error(history.stderr)
if(history.stdout.includes('user_equipment')) throw new Error('Run against a local database before the equipment migration; no reset is performed.')
const applied=new Set(history.stdout.trim().split('\n'))
const body=name=>fs.readFileSync('supabase/migrations/'+name,'utf8').replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,'')
const files=fs.readdirSync('supabase/migrations').filter(n=>/^\d+_.*\.sql$/.test(n)&&!applied.has(n.split('_')[0])).sort()
const fixture=`
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000083');
insert into public.surf_spots(id,user_id,name) values ('10000000-0000-4000-8000-000000000083','00000000-0000-4000-8000-000000000083','Migration fixture');
insert into public.surf_sessions(id,user_id,spot_id,started_at,ended_at,board_name)
select ('20000000-0000-4000-8000-00000000008'||n)::uuid,'00000000-0000-4000-8000-000000000083','10000000-0000-4000-8000-000000000083','2026-11-22T00:00:00Z','2026-11-22T01:00:00Z',case n when 3 then '  Old Board  ' when 4 then E'old\\tboard' else repeat('x',201) end from generate_series(3,5) n;
insert into public.surf_session_conditions(session_id,wetsuit) select id,' 4/3mm ' from public.surf_sessions where user_id='00000000-0000-4000-8000-000000000083';
`
const statements=files.map(name=>(name.endsWith('_user_equipment.sql') ? fixture : '')+body(name)).join('\n')
const checks=`
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(5);
select is((select count(*) from public.user_equipment where user_id='00000000-0000-4000-8000-000000000083'),2::bigint,'Distinct legacy board and suit are imported');
select is((select count(*) from public.user_equipment where user_id='00000000-0000-4000-8000-000000000083' and normalized_name='old board'),1::bigint,'Case and whitespace variants collapse');
select is((select board_name from public.surf_sessions where id='20000000-0000-4000-8000-000000000083'),'  Old Board  ','Original board snapshot preserved');
select is((select wetsuit from public.surf_session_conditions where session_id='20000000-0000-4000-8000-000000000083'),' 4/3mm ','Original suit snapshot preserved');
select is((select length(board_name) from public.surf_sessions where id='20000000-0000-4000-8000-000000000085'),201,'Oversized historical text preserved, not truncated');
select * from finish();
`
const result=spawnSync('docker',args,{input:'begin;\n'+statements+'\n'+checks+'\nrollback;',encoding:'utf8'})
console.log(result.stdout.split('\n').filter(line=>/^(ok|not ok|#|1\.\.|ROLLBACK)/.test(line)).join('\n'))
if(result.stderr) console.error(result.stderr)
process.exit(result.status || (/^not ok/m.test(result.stdout) ? 1 : 0))
