-- Review fixes (2026-11-16):
-- 1. A walk-in created after its slot started (18:20 in the 18:00 slot) was closed as no-show by
--    the next cron run. The no-show clock now starts at whichever is later: the appointment or
--    the moment the booking was created.
-- 2. Staff edits ('none' time rule) could move a booking into a slot that is already past its
--    no-show time, so it was closed (and the customer mailed) right away. New rule 'edit'.

-- create_booking: created_at follows p_now like booking_events, so the dev clock and the
-- no-show rule agree on when the booking was made.
create or replace function public.create_booking(
  p_channel public.booking_channel,
  p_date date,
  p_start time,
  p_party int,
  p_name text,
  p_phone text,
  p_email text,
  p_note text,
  p_actor uuid,
  p_actor_name text,
  p_now timestamptz
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_code text;
begin
  perform pg_advisory_xact_lock(hashtext('bookings:' || p_date::text));

  perform public.booking_validate(
    p_date, p_start, p_party, null, p_now,
    case when p_channel = 'walk_in' then 'walkin' else 'cutoff' end
  );

  v_code := 'BK-' || to_char(p_now at time zone 'Asia/Bangkok', 'YYMM') || '-'
    || lpad(nextval('public.booking_code_seq')::text, 4, '0');

  begin
    insert into public.bookings (
      code, booking_date, start_time, starts_at, ends_at, party_size,
      customer_name, phone, email, channel, note, created_by, created_at
    ) values (
      v_code, p_date, p_start,
      (p_date + p_start) at time zone 'Asia/Bangkok',
      ((p_date + p_start) + interval '120 minutes') at time zone 'Asia/Bangkok',
      p_party, p_name, p_phone, nullif(p_email, ''), p_channel, nullif(p_note, ''), p_actor, p_now
    ) returning id into v_id;
  exception when unique_violation then
    raise exception 'phone_daily_limit' using errcode = 'P0001';
  end;

  insert into public.booking_events (booking_id, kind, to_status, actor_id, actor_name, actor_kind, created_at)
  values (v_id, 'created', 'waiting', p_actor, p_actor_name,
          case when p_actor is null then 'customer' else 'staff' end, p_now);

  return v_id;
end;
$$;

-- time_rule: 'cutoff' (web, phone-in), 'walkin', 'edit' (Staff edits).
create or replace function public.booking_validate(
  p_date date,
  p_start time,
  p_party int,
  p_exclude uuid,
  p_now timestamptz,
  p_time_rule text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_now_local timestamp := p_now at time zone 'Asia/Bangkok';
  v_today date := (p_now at time zone 'Asia/Bangkok')::date;
  v_slot_local timestamp := p_date + p_start;
  v_start_min int := extract(hour from p_start)::int * 60 + extract(minute from p_start)::int;
  v_hours public.business_hours;
  v_open_min int;
  v_close_min int;
  v_max int;
  v_load int;
  v_point int;
  i int;
begin
  if p_date < v_today or p_date > (v_today + interval '1 month')::date then
    raise exception 'date_range' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.special_holidays where holiday_date = p_date) then
    raise exception 'holiday' using errcode = 'P0001';
  end if;

  select * into v_hours from public.business_hours where weekday = extract(dow from p_date)::int;
  if not found or not v_hours.is_open then
    raise exception 'closed_day' using errcode = 'P0001';
  end if;

  v_open_min := extract(hour from v_hours.open_time)::int * 60 + extract(minute from v_hours.open_time)::int;
  v_close_min := extract(hour from v_hours.close_time)::int * 60 + extract(minute from v_hours.close_time)::int;
  if v_start_min < v_open_min or v_start_min > v_close_min - 120 or (v_start_min - v_open_min) % 30 <> 0 then
    raise exception 'bad_slot' using errcode = 'P0001';
  end if;

  if p_time_rule = 'cutoff' and v_slot_local - interval '15 minutes' < v_now_local then
    raise exception 'past_cutoff' using errcode = 'P0001';
  elsif p_time_rule = 'walkin' and v_slot_local + interval '30 minutes' <= v_now_local then
    raise exception 'slot_passed' using errcode = 'P0001';
  elsif p_time_rule = 'edit' and v_slot_local + interval '15 minutes' <= v_now_local then
    -- Past the no-show time: run_booking_closures would close it on its next run.
    raise exception 'slot_passed' using errcode = 'P0001';
  end if;

  select coalesce(sum(seats), 0) into v_max from public.dining_tables where is_active;

  for i in 0..3 loop
    v_point := v_start_min + i * 30;
    select coalesce(sum(b.party_size), 0) into v_load
    from public.bookings b
    where b.booking_date = p_date
      and b.status in ('waiting', 'arrived', 'seated')
      and (p_exclude is null or b.id <> p_exclude)
      and (extract(hour from b.start_time)::int * 60 + extract(minute from b.start_time)::int) <= v_point
      and v_point < (extract(hour from b.start_time)::int * 60 + extract(minute from b.start_time)::int) + 120;
    if v_load + p_party > v_max then
      raise exception 'no_quota' using errcode = 'P0001';
    end if;
  end loop;
end;
$$;

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
      case when p_enforce_cutoff then 'cutoff' else 'edit' end
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

create or replace function public.run_booking_closures(p_now timestamptz default now())
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_no_show int;
  v_closed int;
begin
  -- SYS-03: 15 minutes after the appointment, or after creation for a booking made once its
  -- slot had already started (walk-ins).
  with due as (
    select b.id, b.status as old_status
    from public.bookings b
    where b.status = 'waiting' and greatest(b.starts_at, b.created_at) + interval '15 minutes' <= p_now
    order by b.id
    for update of b skip locked
  ), closed as (
    update public.bookings b set status = 'system_closed'
    from due where b.id = due.id
    returning b.id, b.email
  ), ev as (
    insert into public.booking_events (booking_id, kind, from_status, to_status, details, actor_name, actor_kind, created_at)
    select id, 'status', 'waiting', 'system_closed', jsonb_build_object('reason', 'no_show'), 'ระบบ', 'system', p_now
    from closed
  ), mail as (
    insert into public.email_outbox (booking_id, to_email, template, status)
    select id, email, 'no_show', 'pending' from closed where coalesce(email, '') <> ''
  )
  select count(*) into v_no_show from closed;

  with due as (
    select b.id, b.status as old_status
    from public.bookings b
    left join public.business_hours h on h.weekday = extract(dow from b.booking_date)::int
    where b.status in ('waiting', 'arrived', 'seated')
      and p_now >= case
        when coalesce(h.is_open, false)
          and not exists (select 1 from public.special_holidays s where s.holiday_date = b.booking_date)
        then (b.booking_date + h.close_time) at time zone 'Asia/Bangkok'
        else b.ends_at
      end
    order by b.id
    for update of b skip locked
  ), closed as (
    update public.bookings b set status = 'system_closed'
    from due where b.id = due.id
    returning b.id, due.old_status
  ), ev as (
    insert into public.booking_events (booking_id, kind, from_status, to_status, details, actor_name, actor_kind, created_at)
    select id, 'status', old_status, 'system_closed', jsonb_build_object('reason', 'store_closed'), 'ระบบ', 'system', p_now
    from closed
  )
  select count(*) into v_closed from closed;

  return jsonb_build_object('no_show', v_no_show, 'store_closed', v_closed);
end;
$$;
