-- Phase 1: store settings (tables, business hours, special holidays) and back-office user management.

-- Soft delete: Phase 2 status history will record who performed each action, so staff rows
-- must stay even after the account is removed. A removed username cannot be reused.
alter table public.profiles add column deleted_at timestamptz;

-- RLS helper. SECURITY DEFINER so the lookup bypasses profiles' own RLS (no recursion when
-- used inside profiles policies). Not callable by anon.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and deleted_at is null
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create policy "profiles: admin reads all"
  on public.profiles
  for select
  to authenticated
  using ((select public.is_admin()));

-- Last line of defence for "the system must always have at least one active Admin"
-- (OQ-15 / TC-108). The advisory lock serialises concurrent demotions/deletions, otherwise
-- two Admins removing each other at the same moment would both see the other as still active.
create function public.ensure_active_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role = 'admin' and old.deleted_at is null
     and (new.role <> 'admin' or new.deleted_at is not null) then
    perform pg_advisory_xact_lock(hashtext('profiles.active_admin'));
    if not exists (
      select 1
      from public.profiles
      where role = 'admin' and deleted_at is null and id <> old.id
    ) then
      raise exception 'last_active_admin' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_ensure_active_admin
  before update on public.profiles
  for each row execute function public.ensure_active_admin();

-- Tables. Named dining_tables because "tables" is too easy to confuse with SQL objects.
-- No delete policy on purpose: tables are deactivated so old bookings keep their seating history.
create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  name text not null
    constraint dining_tables_name_length check (char_length(name) between 1 and 20),
  seats smallint not null
    constraint dining_tables_seats_range check (seats between 1 and 20),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index dining_tables_name_key on public.dining_tables (lower(name));

create trigger dining_tables_set_updated_at
  before update on public.dining_tables
  for each row execute function public.set_updated_at();

-- Weekly opening hours, 0 = Sunday ... 6 = Saturday. Slots are 30 minutes counted from the
-- opening time and the last slot is closing - 120 min (EDD), so a day must be open at least
-- 120 minutes. Closing after midnight is not supported.
create table public.business_hours (
  weekday smallint primary key
    constraint business_hours_weekday_range check (weekday between 0 and 6),
  is_open boolean not null default true,
  open_time time,
  close_time time,
  updated_at timestamptz not null default now(),
  constraint business_hours_times check (
    (not is_open and open_time is null and close_time is null)
    or (
      is_open
      and open_time is not null
      and close_time is not null
      and extract(minute from open_time) in (0, 30)
      and extract(second from open_time) = 0
      and extract(minute from close_time) in (0, 30)
      and extract(second from close_time) = 0
      and close_time - open_time >= interval '120 minutes'
    )
  )
);

create trigger business_hours_set_updated_at
  before update on public.business_hours
  for each row execute function public.set_updated_at();

-- Special holidays close the whole day.
create table public.special_holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.dining_tables enable row level security;
alter table public.business_hours enable row level security;
alter table public.special_holidays enable row level security;

-- Staff need to read these in Phase 2 (seating, creating bookings); only Admin may change them.
-- Customer-facing reads (anon) are decided in Phase 4.
create policy "dining_tables: staff read" on public.dining_tables
  for select to authenticated using (true);
create policy "dining_tables: admin insert" on public.dining_tables
  for insert to authenticated with check ((select public.is_admin()));
create policy "dining_tables: admin update" on public.dining_tables
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "business_hours: staff read" on public.business_hours
  for select to authenticated using (true);
create policy "business_hours: admin insert" on public.business_hours
  for insert to authenticated with check ((select public.is_admin()));
create policy "business_hours: admin update" on public.business_hours
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "special_holidays: staff read" on public.special_holidays
  for select to authenticated using (true);
create policy "special_holidays: admin insert" on public.special_holidays
  for insert to authenticated with check ((select public.is_admin()));
create policy "special_holidays: admin delete" on public.special_holidays
  for delete to authenticated using ((select public.is_admin()));
