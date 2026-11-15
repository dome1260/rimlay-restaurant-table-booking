-- Phase 5: customer edit / cancel (CUS-10, CUS-11). Customer-only entry points: the owner is
-- proven by phone + email (the session), the 15 minute deadline is enforced here, and the actor
-- is always "customer". Staff keep using update_booking / change_booking_status.
-- A booking that isn't theirs answers 'not_found', same as one that doesn't exist.

create function public.update_web_booking(
  p_id uuid,
  p_phone text,
  p_owner_email text,
  p_date date,
  p_start time,
  p_party int,
  p_name text,
  p_email text,
  p_now timestamptz
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v public.bookings;
begin
  if nullif(trim(p_email), '') is null then
    raise exception 'email_required' using errcode = 'P0001';
  end if;

  select * into v from public.bookings
  where id = p_id and phone = p_phone and lower(email) = lower(p_owner_email);
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v.status <> 'waiting' then
    raise exception 'bad_status' using errcode = 'P0001';
  end if;
  if v.starts_at - interval '15 minutes' < p_now then
    raise exception 'too_late' using errcode = 'P0001';
  end if;

  perform public.update_booking(p_id, p_date, p_start, p_party, p_name, trim(p_email), coalesce(v.note, ''), null, p_name, p_now, true);
end;
$$;

create function public.cancel_web_booking(
  p_id uuid,
  p_phone text,
  p_owner_email text,
  p_now timestamptz
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v public.bookings;
begin
  select * into v from public.bookings
  where id = p_id and phone = p_phone and lower(email) = lower(p_owner_email)
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v.status <> 'waiting' then
    raise exception 'bad_transition' using errcode = 'P0001';
  end if;
  if v.starts_at - interval '15 minutes' < p_now then
    raise exception 'too_late' using errcode = 'P0001';
  end if;

  update public.bookings set status = 'cancelled' where id = p_id;
  insert into public.booking_events (booking_id, kind, from_status, to_status, actor_id, actor_name, actor_kind, created_at)
  values (p_id, 'status', 'waiting', 'cancelled', null, v.customer_name, 'customer', p_now);
end;
$$;

revoke all on function public.update_web_booking(uuid, text, text, date, time, int, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.update_web_booking(uuid, text, text, date, time, int, text, text, timestamptz) to service_role;
revoke all on function public.cancel_web_booking(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.cancel_web_booking(uuid, text, text, timestamptz) to service_role;
