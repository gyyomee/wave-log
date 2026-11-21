begin;

-- Extend the owner-protected 1:1 record. Existing scalar values and samples
-- are deliberately not backfilled, reassigned to intervals, or deleted.
create function public.wave_log_valid_intervals(items jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog as $$
declare
  item jsonb; field text; bounds jsonb; value numeric; a timestamptz; b timestamptz;
  ids text[] := '{}';
  limits constant jsonb := '{"wave_height":[0,50],"wave_period":[0,100],"swell_height":[0,50],"swell_period":[0,100],"swell_direction":[0,360],"wind_speed":[0,150],"wind_direction":[0,360],"water_temperature":[-10,50],"air_temperature":[-100,70]}';
begin
  if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items) > 1000 then return false; end if;
  for item in select * from jsonb_array_elements(items) loop
    if jsonb_typeof(item) is distinct from 'object' or coalesce(item->>'id','') = '' then return false; end if;
    if item->>'id' = any(ids) then return false; end if;
    ids := array_append(ids,item->>'id');
    if not coalesce(item->>'started_at' ~ 'T.*Z$',false) or not coalesce(item->>'ended_at' ~ 'T.*Z$',false) then return false; end if;
    a := (item->>'started_at')::timestamptz; b := (item->>'ended_at')::timestamptz;
    if b <= a or b - a > interval '3 hours' then return false; end if;
    if jsonb_typeof(item->'api_values') is distinct from 'object' or jsonb_typeof(item->'manual_fields') is distinct from 'array' then return false; end if;
    for field, bounds in select entry.key,entry.value from jsonb_each(limits) entry loop
      if item ? field and item->field <> 'null'::jsonb then
        if jsonb_typeof(item->field) <> 'number' then return false; end if;
        value := (item->>field)::numeric;
        if value < (bounds->>0)::numeric or value > (bounds->>1)::numeric then return false; end if;
      end if;
    end loop;
    if exists (select 1 from jsonb_array_elements_text(item->'manual_fields') f where not limits ? f) then return false; end if;
  end loop;
  return true;
exception when others then return false;
end $$;

create function public.wave_log_valid_tides(items jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog as $$
declare item jsonb; height numeric; ids text[] := '{}'; event_at timestamptz;
begin
  if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items) > 500 then return false; end if;
  for item in select * from jsonb_array_elements(items) loop
    if jsonb_typeof(item) is distinct from 'object' or coalesce(item->>'id','') = '' then return false; end if;
    if item->>'id' = any(ids) then return false; end if;
    ids := array_append(ids,item->>'id');
    if not coalesce(item->>'type' in ('high','low'),false) or not coalesce(item->>'source' in ('manual','khoa'),false) then return false; end if;
    if item->>'timezone' is distinct from 'Asia/Seoul' then return false; end if;
    if not coalesce(item->>'date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',false) or not coalesce(item->>'time' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$',false) then return false; end if;
    event_at := ((item->>'date') || 'T' || (item->>'time') || ':00+09:00')::timestamptz;
    if not coalesce(item->>'occurred_at' ~ 'T.*Z$',false) or (item->>'occurred_at')::timestamptz <> event_at then return false; end if;
    if item ? 'height_cm' and item->'height_cm' <> 'null'::jsonb then
      if jsonb_typeof(item->'height_cm') <> 'number' then return false; end if;
      height := (item->>'height_cm')::numeric;
      if height < -5000 or height > 5000 then return false; end if;
    end if;
    if item->>'source' = 'khoa' and (coalesce(item->>'station_id','') = '' or coalesce(item->>'station_name','') = '' or jsonb_typeof(item->'original') is distinct from 'object') then return false; end if;
  end loop;
  return true;
exception when others then return false;
end $$;

revoke all on function public.wave_log_valid_intervals(jsonb), public.wave_log_valid_tides(jsonb) from public;
grant execute on function public.wave_log_valid_intervals(jsonb), public.wave_log_valid_tides(jsonb) to authenticated;

alter table public.surf_session_conditions
  add column condition_intervals jsonb not null default '[]'::jsonb check (public.wave_log_valid_intervals(condition_intervals)),
  add column condition_hourly jsonb not null default '[]'::jsonb check (jsonb_typeof(condition_hourly) = 'array'),
  add column tide_cycle_label text check (char_length(tide_cycle_label) <= 80),
  add column tide_convention text check (tide_convention in ('7','8','custom')),
  add column tide_events jsonb not null default '[]'::jsonb check (public.wave_log_valid_tides(tide_events));

comment on column public.surf_session_conditions.condition_intervals is 'Effective per-interval values, original API representatives and manual overrides. Old boundary rows retained as history.';
comment on column public.surf_session_conditions.condition_hourly is 'Append-only in client: hourly source snapshots and provenance, never changed by manual edits.';
comment on column public.surf_session_conditions.tide_events is 'Asia/Seoul local date/time plus UTC instant, high/low, optional cm height, station ID/name, source and original API provenance. Not actual measured tide.';
-- Existing SELECT/INSERT/UPDATE/DELETE RLS policies and grants cover all columns.
commit;
