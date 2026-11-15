-- Phase 4: public booking page. The page is open to everyone, so a sliding-window limit per
-- client (hashed IP) stops one source from filling the quota with fake bookings.
-- Only service_role touches this table: RLS is on and no policy exists.
create table public.booking_attempts (
  id bigint generated always as identity primary key,
  key_hash text not null,
  created_at timestamptz not null
);
create index booking_attempts_key_idx on public.booking_attempts (key_hash, created_at);
alter table public.booking_attempts enable row level security;

-- Returns true while the key is inside its quota and records the attempt; false when over.
create or replace function public.register_booking_attempt(
  p_key text,
  p_now timestamptz,
  p_limit int,
  p_window interval
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_count int;
begin
  perform pg_advisory_xact_lock(hashtext('booking_attempts:' || p_key));

  delete from public.booking_attempts where created_at < p_now - interval '1 day';

  select count(*) into v_count
  from public.booking_attempts
  where key_hash = p_key and created_at > p_now - p_window;

  if v_count >= p_limit then
    return false;
  end if;

  insert into public.booking_attempts (key_hash, created_at) values (p_key, p_now);
  return true;
end;
$$;

revoke all on function public.register_booking_attempt(text, timestamptz, int, interval) from public, anon, authenticated;
grant execute on function public.register_booking_attempt(text, timestamptz, int, interval) to service_role;
