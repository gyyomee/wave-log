begin;
create function public.wave_log_equipment_name(value text)
returns text language sql immutable strict set search_path = '' as $$
  select btrim(regexp_replace(normalize(value, NFC), U&'[[:space:]\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+', ' ', 'g'));
$$;
revoke all on function public.wave_log_equipment_name(text) from public;
grant execute on function public.wave_log_equipment_name(text) to authenticated;

create table public.user_equipment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  equipment_type text not null check (equipment_type in ('surfboard','wetsuit')),
  name text not null check (length(public.wave_log_equipment_name(name)) between 1 and 200),
  normalized_name text generated always as (lower(public.wave_log_equipment_name(name))) stored,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id,equipment_type,normalized_name)
);
create index user_equipment_active_idx on public.user_equipment(user_id,equipment_type) where is_active;
create trigger user_equipment_updated_at before update on public.user_equipment
for each row execute function public.wave_log_set_updated_at();
alter table public.user_equipment enable row level security;
revoke all on public.user_equipment from public, anon, authenticated;
grant select, insert, update on public.user_equipment to authenticated;
create policy equipment_select on public.user_equipment for select to authenticated using ((select auth.uid())=user_id);
create policy equipment_insert on public.user_equipment for insert to authenticated with check ((select auth.uid())=user_id);
create policy equipment_update on public.user_equipment for update to authenticated
using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

-- Backfill only the collection. Historical journal text is never updated.
insert into public.user_equipment(user_id,equipment_type,name)
select distinct on (user_id,equipment_type,lower(public.wave_log_equipment_name(name)))
  user_id,equipment_type,public.wave_log_equipment_name(name)
from (
  select user_id,'surfboard'::text equipment_type,board_name name,created_at from public.surf_sessions
  union all
  select s.user_id,'wetsuit',c.wetsuit,c.created_at from public.surf_session_conditions c join public.surf_sessions s on s.id=c.session_id
) history
where length(public.wave_log_equipment_name(name)) between 1 and 200
order by user_id,equipment_type,lower(public.wave_log_equipment_name(name)),created_at,name;

-- Both names register atomically after the journal and conditions have saved.
create function public.register_my_equipment(p_board text default null,p_wetsuit text default null)
returns setof public.user_equipment language plpgsql security invoker set search_path = '' as $$
declare kind text; label text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  for kind,label in select * from (values ('surfboard',p_board),('wetsuit',p_wetsuit)) as items(kind,label)
  loop
    label:=public.wave_log_equipment_name(label);
    if label is null or label='' then continue; end if;
    return query insert into public.user_equipment(user_id,equipment_type,name)
    values (auth.uid(),kind,label)
    on conflict(user_id,equipment_type,normalized_name) do update set is_active=true
    returning *;
  end loop;
end;
$$;
revoke all on function public.register_my_equipment(text,text) from public, anon;
grant execute on function public.register_my_equipment(text,text) to authenticated;
commit;
