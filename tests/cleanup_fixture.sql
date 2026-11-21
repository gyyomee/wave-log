insert into auth.users(id) values ('54000000-0000-4000-a000-000000000001');
insert into public.surf_spots(id,user_id,name,latitude,longitude) values
('54100000-0000-4000-a000-000000000001','54000000-0000-4000-a000-000000000001','Cleanup fixture',37,129);
insert into public.surf_sessions(id,user_id,spot_id,started_at,ended_at) values
('54200000-0000-4000-a000-000000000001','54000000-0000-4000-a000-000000000001','54100000-0000-4000-a000-000000000001','2026-10-01T00:00Z','2026-10-01T06:00Z');
insert into public.surf_session_conditions(session_id,wave_height,manual_fields,condition_intervals,condition_hourly)
select '54200000-0000-4000-a000-000000000001',4,array['wave_height'],
jsonb_build_array(
 jsonb_build_object('id','forecast:2026-09-30T00:00:00Z','forecast_at','2026-09-30T00:00:00Z','started_at','2026-09-30T00:00:00Z','ended_at','2026-09-30T00:00:00.001Z','wave_height',2,'api_values',jsonb_build_object('wave_height',jsonb_build_object('value',2)),'manual_fields','[]'::jsonb),
 jsonb_build_object('id','manual','started_at','2026-09-30T00:00:00Z','ended_at','2026-09-30T01:00:00Z','wave_height',4,'api_values','{}'::jsonb,'manual_fields',jsonb_build_array('wave_height')),
 jsonb_build_object('id','uncertain','started_at','2026-09-30T00:00:00Z','ended_at','2026-09-30T01:00:00Z','wave_height',9,'api_values','{}'::jsonb,'manual_fields','[]'::jsonb)
),
jsonb_build_array(g,g)
from (select jsonb_build_object('fields',jsonb_build_array('wave_height'),'metadata',jsonb_build_object('provider','open-meteo','context','[37,129,"2026-09-30T00:00:00Z","2026-10-01T06:00:00Z"]','fetched_at','2026-10-02T00:00:00Z'),'rows',jsonb_build_array(
jsonb_build_object('sampled_at','2026-09-30T00:00:00Z','wave_height',1),
jsonb_build_object('sampled_at','2026-10-01T01:00:00Z','wave_height',2))) as g) x;
insert into public.surf_session_marine_samples(session_id,sampled_at,wave_height,data_provider,data_model,data_source_type,requested_latitude,requested_longitude,spot_id,session_started_at,session_ended_at)
select '54200000-0000-4000-a000-000000000001',t,2,'open-meteo','meteofrance_wave','archived_forecast',37,129,'54100000-0000-4000-a000-000000000001','2026-09-30T00:00Z','2026-10-02T00:00Z'
from unnest(array['2026-09-30T00:00Z'::timestamptz,'2026-10-01T01:00Z'::timestamptz]) t;
