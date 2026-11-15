-- Review fix (Phase 4): refusals by a booking rule (slot full, past cutoff, phone already booked)
-- must not use up the customer's attempts, or a genuine customer racing for a busy slot gets
-- locked out. register_booking_attempt now returns the attempt id (null when over the limit) so
-- the caller can delete it again when create_booking refuses; the row is still written before
-- the booking so concurrent requests can't slip past the limit together.
drop function if exists public.register_booking_attempt(text, timestamptz, int, interval);

create index if not exists booking_attempts_created_idx on public.booking_attempts (created_at);

create function public.register_booking_attempt(
  p_key text,
  p_now timestamptz,
  p_limit int,
  p_window interval
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_count int;
  v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtext('booking_attempts:' || p_key));

  delete from public.booking_attempts where created_at < p_now - interval '1 day';

  select count(*) into v_count
  from public.booking_attempts
  where key_hash = p_key and created_at > p_now - p_window and created_at <= p_now;

  if v_count >= p_limit then
    return null;
  end if;

  insert into public.booking_attempts (key_hash, created_at) values (p_key, p_now) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.register_booking_attempt(text, timestamptz, int, interval) from public, anon, authenticated;
grant execute on function public.register_booking_attempt(text, timestamptz, int, interval) to service_role;
