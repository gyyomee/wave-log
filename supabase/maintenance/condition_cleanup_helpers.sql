-- Transaction-local helpers only. Included by audit/cleanup scripts.
create or replace function pg_temp.is_auto_interval(item jsonb) returns boolean
language sql immutable as $$
 select coalesce(
   item->>'id' ~ '^(forecast:)?[0-9]{4}-[0-9]{2}-[0-9]{2}T'
   and coalesce(item->'manual_fields','[]') = '[]'::jsonb
   and coalesce(item->'manual_origins','{}') = '{}'::jsonb
   and not exists(select 1 from jsonb_object_keys(item) k where k <> all(array['id','forecast_at','started_at','ended_at','api_values','manual_fields','manual_origins','context','wave_height','wave_period','swell_height','swell_period','swell_direction','wind_speed','wind_direction','water_temperature','air_temperature']))
   and not exists (
     select 1 from unnest(array['wave_height','wave_period','swell_height','swell_period','swell_direction','wind_speed','wind_direction','water_temperature','air_temperature']) k
     where item ? k and item->k <> 'null'::jsonb and item->k <> '""'::jsonb
       and item->k is distinct from item#>array['api_values',k,'value']
   ),false)
$$;
create or replace function pg_temp.compact_sources(groups jsonb, a timestamptz, b timestamptz, lat numeric, lon numeric)
returns jsonb language plpgsql as $$
declare
 g jsonb; r jsonb; point jsonb; field text; key text; entry jsonb;
 result jsonb := '{}'; unknowns jsonb := '[]'; rows jsonb;
 first_time timestamptz := to_timestamp(floor(extract(epoch from a)/10800)*10800);
 last_time timestamptz := to_timestamp(ceil(extract(epoch from b)/10800)*10800);
begin
 -- Seoul offset (9h) is a multiple of 3h; these UTC boundaries are identical.
 for g in select * from jsonb_array_elements(groups) loop
   if g#>>'{metadata,provider}' is distinct from 'open-meteo'
      or jsonb_typeof(g->'rows') is distinct from 'array'
      or jsonb_typeof(g->'fields') is distinct from 'array' then
     unknowns := unknowns || jsonb_build_array(g); continue;
   end if;
   point := (g#>>'{metadata,context}')::jsonb;
   if lat is null or lon is null then
     unknowns := unknowns || jsonb_build_array(g); continue;
   end if;
   if (point->>0)::numeric is distinct from lat or (point->>1)::numeric is distinct from lon then continue; end if;
   for r in select * from jsonb_array_elements(g->'rows') loop
     if (r->>'sampled_at')::timestamptz < first_time or (r->>'sampled_at')::timestamptz > last_time then continue; end if;
     if r->>'sampled_at' is null then raise exception 'Unknown source time'; end if;
     for field in select * from jsonb_array_elements_text(g->'fields') loop
       key := field || ':' || (r->>'sampled_at')::timestamptz::text;
       entry := jsonb_build_object('fields',jsonb_build_array(field),'rows',jsonb_build_array(r),'metadata',g->'metadata');
       if not result ? key or coalesce((result->key#>>'{metadata,fetched_at}')::timestamptz,'-infinity') <= coalesce((g#>>'{metadata,fetched_at}')::timestamptz,'-infinity') then
         result := jsonb_set(result,array[key],entry);
       end if;
     end loop;
   end loop;
 end loop;
 return unknowns || coalesce((select jsonb_agg(e.value order by e.key) from jsonb_each(result) e),'[]');
exception when others then
 -- Ambiguous/malformed provenance is NOT evidence that data may be deleted.
 return groups;
end $$;

create or replace temp view cleanup_conditions as
select c.session_id,
 coalesce((select jsonb_agg(x order by ord) from jsonb_array_elements(c.condition_intervals) with ordinality t(x,ord) where not pg_temp.is_auto_interval(x)),'[]') as retained_intervals,
 pg_temp.compact_sources(c.condition_hourly,s.started_at,s.ended_at,p.latitude,p.longitude) as retained_sources
from public.surf_session_conditions c
join public.surf_sessions s on s.id=c.session_id
join public.surf_spots p on p.id=s.spot_id;

create or replace temp view cleanup_marine as
select m.id,m.session_id
from public.surf_session_marine_samples m join public.surf_sessions s on s.id=m.session_id
where m.data_provider='open-meteo' and m.data_source_type in ('forecast','archived_forecast','historical_model')
 and (m.sampled_at < to_timestamp(floor(extract(epoch from s.started_at)/10800)*10800)
   or m.sampled_at > to_timestamp(ceil(extract(epoch from s.ended_at)/10800)*10800));
