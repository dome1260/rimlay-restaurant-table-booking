-- Edit and cancel are only allowed while a booking is still "waiting" (product decision after
-- Phase 2A review). Once the customer has arrived the booking can only move forward.
create or replace function public.change_booking_status(
  p_id uuid,
  p_to public.booking_status,
  p_actor uuid,
  p_actor_name text,
  p_now timestamptz
)
returns public.booking_status
language plpgsql
set search_path = ''
as $$
declare
  v public.bookings;
begin
  select * into v from public.bookings where id = p_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if not (
    (v.status = 'waiting' and p_to in ('arrived', 'cancelled'))
    or (v.status = 'seated' and p_to = 'closed')
  ) then
    raise exception 'bad_transition' using errcode = 'P0001';
  end if;

  update public.bookings set status = p_to where id = p_id;
  insert into public.booking_events (booking_id, kind, from_status, to_status, actor_id, actor_name, actor_kind, created_at)
  values (p_id, 'status', v.status, p_to, p_actor, p_actor_name, 'staff', p_now);

  return v.status;
end;
$$;

-- update_booking: only re-validate the status check; body otherwise unchanged.
create or replace function public.update_booking(
  p_id uuid,
  p_date date,
  p_start time,
  p_party int,
  p_name text,
  p_email text,
  p_note text,
  p_actor uuid,
  p_actor_name text,
  p_now timestamptz,
  p_enforce_cutoff boolean
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v public.bookings;
  v_details jsonb := '{}'::jsonb;
  v_slot_changed boolean;
  v_lock_a text;
  v_lock_b text;
begin
  select * into v from public.bookings where id = p_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  v_lock_a := 'bookings:' || least(v.booking_date, p_date)::text;
  v_lock_b := 'bookings:' || greatest(v.booking_date, p_date)::text;
  perform pg_advisory_xact_lock(hashtext(v_lock_a));
  if v_lock_b <> v_lock_a then
    perform pg_advisory_xact_lock(hashtext(v_lock_b));
  end if;

  select * into v from public.bookings where id = p_id;
  if v.status <> 'waiting' then
    raise exception 'bad_status' using errcode = 'P0001';
  end if;

  v_slot_changed := v.booking_date <> p_date or v.start_time <> p_start or v.party_size <> p_party;
  if v_slot_changed then
    perform public.booking_validate(
      p_date, p_start, p_party, p_id, p_now,
      case when p_enforce_cutoff then 'cutoff' else 'none' end
    );
  end if;

  if v.booking_date <> p_date then
    v_details := v_details || jsonb_build_object('booking_date', jsonb_build_object('from', v.booking_date, 'to', p_date));
  end if;
  if v.start_time <> p_start then
    v_details := v_details || jsonb_build_object(
      'start_time', jsonb_build_object('from', to_char(v.start_time, 'HH24:MI'), 'to', to_char(p_start, 'HH24:MI')));
  end if;
  if v.party_size <> p_party then
    v_details := v_details || jsonb_build_object('party_size', jsonb_build_object('from', v.party_size, 'to', p_party));
  end if;
  if v.customer_name <> p_name then
    v_details := v_details || jsonb_build_object('customer_name', jsonb_build_object('from', v.customer_name, 'to', p_name));
  end if;
  if coalesce(v.email, '') <> coalesce(p_email, '') then
    v_details := v_details || jsonb_build_object('email', jsonb_build_object('from', v.email, 'to', nullif(p_email, '')));
  end if;
  if coalesce(v.note, '') <> coalesce(p_note, '') then
    v_details := v_details || jsonb_build_object('note', jsonb_build_object('from', v.note, 'to', nullif(p_note, '')));
  end if;

  begin
    update public.bookings set
      booking_date = p_date,
      start_time = p_start,
      starts_at = (p_date + p_start) at time zone 'Asia/Bangkok',
      ends_at = ((p_date + p_start) + interval '120 minutes') at time zone 'Asia/Bangkok',
      party_size = p_party,
      customer_name = p_name,
      email = nullif(p_email, ''),
      note = nullif(p_note, '')
    where id = p_id;
  exception when unique_violation then
    raise exception 'phone_daily_limit' using errcode = 'P0001';
  end;

  if v_details <> '{}'::jsonb then
    insert into public.booking_events (booking_id, kind, details, actor_id, actor_name, actor_kind, created_at)
    values (p_id, 'edited', v_details, p_actor, p_actor_name,
            case when p_actor is null then 'customer' else 'staff' end, p_now);
  end if;
end;
$$;
