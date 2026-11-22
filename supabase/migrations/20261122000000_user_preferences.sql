begin;
create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wind_speed_unit text not null default 'kts' check (wind_speed_unit in ('kts', 'm/s')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger user_preferences_updated_at before update on public.user_preferences
for each row execute function public.wave_log_set_updated_at();
alter table public.user_preferences enable row level security;
revoke all on public.user_preferences from public, anon, authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
create policy preferences_select on public.user_preferences for select to authenticated
using ((select auth.uid()) = user_id);
create policy preferences_insert on public.user_preferences for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy preferences_update on public.user_preferences for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy preferences_delete on public.user_preferences for delete to authenticated
using ((select auth.uid()) = user_id);
commit;
