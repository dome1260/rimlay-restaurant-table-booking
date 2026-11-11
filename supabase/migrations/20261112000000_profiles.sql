-- Back-office users (Staff / Admin). Customers never log in, so only staff accounts live here.
create type public.app_role as enum ('staff', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    constraint profiles_username_format check (username ~ '^[a-z0-9._-]{3,30}$'),
  display_name text not null,
  email text not null,
  role public.app_role not null default 'staff',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Phase 0: a signed-in user may read only their own profile. Writes go through the
-- server with the secret key, and username → email lookup also stays server-side so
-- the anon/publishable key can never enumerate staff emails.
create policy "profiles: read own row"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
