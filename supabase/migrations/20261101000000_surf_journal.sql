begin;

create table public.surf_spots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  region text,
  country text,
  latitude numeric check (latitude between -90 and 90),
  longitude numeric check (longitude between -180 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.surf_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  spot_id uuid not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  board_name text,
  board_length_ft numeric check (board_length_ft > 0 and board_length_ft < 'Infinity'::numeric),
  overall_rating integer check (overall_rating between 1 and 5),
  wave_rating integer check (wave_rating between 1 and 5),
  performance_rating integer check (performance_rating between 1 and 5),
  crowd_level integer check (crowd_level between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint surf_sessions_time_order check (ended_at > started_at and isfinite(started_at) and isfinite(ended_at)),
  constraint surf_sessions_owned_spot_fkey foreign key (spot_id, user_id)
    references public.surf_spots(id, user_id) on delete no action
);

create index surf_spots_user_name_idx on public.surf_spots(user_id, name);
create index surf_sessions_user_started_idx on public.surf_sessions(user_id, started_at desc, id desc);
create index surf_sessions_spot_user_idx on public.surf_sessions(spot_id, user_id);

create function public.wave_log_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.wave_log_set_updated_at() from public;

create trigger surf_spots_updated_at before update on public.surf_spots
for each row execute function public.wave_log_set_updated_at();

alter table public.surf_spots enable row level security;
revoke all on public.surf_spots from public, anon, authenticated;
grant select, insert, update, delete on public.surf_spots to authenticated;

create policy surf_spots_select on public.surf_spots for select to authenticated
using ((select auth.uid()) = user_id);
create policy surf_spots_insert on public.surf_spots for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy surf_spots_update on public.surf_spots for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy surf_spots_delete on public.surf_spots for delete to authenticated
using ((select auth.uid()) = user_id);

create trigger surf_sessions_updated_at before update on public.surf_sessions
for each row execute function public.wave_log_set_updated_at();

alter table public.surf_sessions enable row level security;
revoke all on public.surf_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.surf_sessions to authenticated;

create policy surf_sessions_select on public.surf_sessions for select to authenticated
using ((select auth.uid()) = user_id);
create policy surf_sessions_insert on public.surf_sessions for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy surf_sessions_update on public.surf_sessions for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy surf_sessions_delete on public.surf_sessions for delete to authenticated
using ((select auth.uid()) = user_id);

commit;
