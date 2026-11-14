-- Phase 2A: bookings, status history, table assignment, email outbox and the booking RPCs.
-- All writes go through the RPCs below (called with the secret key from Server Actions) so the
-- quota / one-phone-per-day / cutoff rules live in one place and are re-checked under a lock.

create type public.booking_status as enum (
  'waiting', 'arrived', 'seated', 'closed', 'system_closed', 'cancelled'
);
create type public.booking_channel as enum ('web', 'walk_in', 'phone_in');

create sequence public.booking_code_seq;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  booking_date date not null,
  start_time time not null
    constraint bookings_start_on_slot check (
      extract(minute from start_time) in (0, 30) and extract(second from start_time) = 0
    ),
  -- SYS-05: internal start/end (start + EDD). Never shown to customers.
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  party_size smallint not null
    constraint bookings_party_range check (party_size between 1 and 8),
  customer_name text not null
    constraint bookings_name_length check (char_length(customer_name) between 1 and 100),
  phone text not null
    constraint bookings_phone_format check (phone ~ '^0[689][0-9]{8}$'),
  email text,
  channel public.booking_channel not null,
  status public.booking_status not null default 'waiting',
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- OQ-12: one phone, one open booking per day, across every channel. Final statuses don't count.
-- Enforced by an index so two simultaneous requests can't both pass an application-level check.
create unique index bookings_phone_day_open_key
  on public.bookings (phone, booking_date)
  where status in ('waiting', 'arrived', 'seated');

create index bookings_date_idx on public.bookings (booking_date, start_time);

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- Kept after the booking closes so old bookings still show tables that were deactivated later (TC-084).
create table public.booking_tables (
  booking_id uuid not null references public.bookings (id) on delete cascade,
  table_id uuid not null references public.dining_tables (id),
  primary key (booking_id, table_id)
);

create table public.booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  kind text not null check (kind in ('created', 'edited', 'status')),
  from_status public.booking_status,
  to_status public.booking_status,
  details jsonb,
  actor_id uuid references public.profiles (id) on delete set null,
  -- Snapshot: Staff can't read other profiles through RLS, and the name should survive renames.
  actor_name text,
  actor_kind text not null check (actor_kind in ('staff', 'customer', 'system')),
  created_at timestamptz not null default now()
);

create index booking_events_booking_idx on public.booking_events (booking_id, id);

-- Fallback until Gmail SMTP credentials exist (Phase 2B); also a log once real sending is wired.
create table public.email_outbox (
  id bigint generated always as identity primary key,
  booking_id uuid references public.bookings (id) on delete set null,
  to_email text not null,
  template text not null,
  subject text not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  error text,
  created_at timestamptz not null default now()
);

-- Any active back-office user (Staff or Admin). Bookings hold customer PII.
create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and deleted_at is null
  );
$$;

revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

alter table public.bookings enable row level security;
alter table public.booking_tables enable row level security;
alter table public.booking_events enable row level security;
alter table public.email_outbox enable row level security;

create policy "bookings: staff read" on public.bookings
  for select to authenticated using ((select public.is_staff()));
create policy "booking_tables: staff read" on public.booking_tables
  for select to authenticated using ((select public.is_staff()));
create policy "booking_events: staff read" on public.booking_events
  for select to authenticated using ((select public.is_staff()));
-- No write policies and none on email_outbox: only the secret key (RPCs / server code) touches them.

-- Shared validation for create and edit. time_rule: 'cutoff' (web, phone-in), 'walkin', 'none'.
create function public.booking_validate(
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
  -- SYS-02: slots every 30 min from opening; the last one leaves room for EDD (120 min).
  if v_start_min < v_open_min or v_start_min > v_close_min - 120 or (v_start_min - v_open_min) % 30 <> 0 then
    raise exception 'bad_slot' using errcode = 'P0001';
  end if;

  if p_time_rule = 'cutoff' and v_slot_local - interval '15 minutes' < v_now_local then
    raise exception 'past_cutoff' using errcode = 'P0001';
  elsif p_time_rule = 'walkin' and v_slot_local + interval '30 minutes' <= v_now_local then
    -- Walk-ins skip the 15 minute cutoff but still can't be put into a slot that is already over.
    raise exception 'slot_passed' using errcode = 'P0001';
  end if;

  select coalesce(sum(seats), 0) into v_max from public.dining_tables where is_active;

  -- SYS-01: check every 30 minute point inside [start, start + 120) and fail on the busiest one.
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

create function public.create_booking(
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
  -- Serialises bookings of the same day so two people can't both take the last seats.
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
      customer_name, phone, email, channel, note, created_by
    ) values (
      v_code, p_date, p_start,
      (p_date + p_start) at time zone 'Asia/Bangkok',
      ((p_date + p_start) + interval '120 minutes') at time zone 'Asia/Bangkok',
      p_party, p_name, p_phone, nullif(p_email, ''), p_channel, nullif(p_note, ''), p_actor
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

-- p_enforce_cutoff: customers (Phase 5) are limited to 15 minutes before the slot; Staff are not.
create function public.update_booking(
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

  -- Lock both days in a fixed order so two edits moving bookings between the same days can't deadlock.
  v_lock_a := 'bookings:' || least(v.booking_date, p_date)::text;
  v_lock_b := 'bookings:' || greatest(v.booking_date, p_date)::text;
  perform pg_advisory_xact_lock(hashtext(v_lock_a));
  if v_lock_b <> v_lock_a then
    perform pg_advisory_xact_lock(hashtext(v_lock_b));
  end if;

  -- Re-read under the lock.
  select * into v from public.bookings where id = p_id;
  if v.status in ('closed', 'system_closed', 'cancelled') then
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

-- Allowed here: waiting -> arrived, waiting/arrived/seated -> cancelled, seated -> closed.
-- arrived -> seated goes through assign_tables; system_closed belongs to the Phase 3 jobs.
create function public.change_booking_status(
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
    or (v.status = 'arrived' and p_to = 'cancelled')
    or (v.status = 'seated' and p_to in ('closed', 'cancelled'))
  ) then
    raise exception 'bad_transition' using errcode = 'P0001';
  end if;

  update public.bookings set status = p_to where id = p_id;
  insert into public.booking_events (booking_id, kind, from_status, to_status, actor_id, actor_name, actor_kind, created_at)
  values (p_id, 'status', v.status, p_to, p_actor, p_actor_name, 'staff', p_now);

  return v.status;
end;
$$;

create function public.assign_tables(
  p_id uuid,
  p_table_ids uuid[],
  p_note text,
  p_actor uuid,
  p_actor_name text,
  p_now timestamptz
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v public.bookings;
  v_names text;
  v_count int;
begin
  -- One lock for all assignments: the "is this table free" check below must not interleave.
  perform pg_advisory_xact_lock(hashtext('table-assignment'));

  select * into v from public.bookings where id = p_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v.status <> 'arrived' then
    raise exception 'bad_transition' using errcode = 'P0001';
  end if;

  if p_table_ids is null or cardinality(p_table_ids) = 0 then
    raise exception 'no_tables' using errcode = 'P0001';
  end if;

  select count(*) into v_count from public.dining_tables where id = any (p_table_ids) and is_active;
  if v_count <> cardinality(p_table_ids) then
    raise exception 'table_inactive' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.booking_tables bt
    join public.bookings b on b.id = bt.booking_id
    where bt.table_id = any (p_table_ids) and b.status = 'seated' and b.id <> p_id
  ) then
    raise exception 'table_busy' using errcode = 'P0001';
  end if;

  insert into public.booking_tables (booking_id, table_id)
  select p_id, unnest(p_table_ids) on conflict do nothing;

  update public.bookings set status = 'seated', note = coalesce(nullif(p_note, ''), note) where id = p_id;

  select string_agg(name, ', ' order by name) into v_names from public.dining_tables where id = any (p_table_ids);
  insert into public.booking_events (booking_id, kind, from_status, to_status, details, actor_id, actor_name, actor_kind, created_at)
  values (p_id, 'status', 'arrived', 'seated', jsonb_build_object('tables', v_names), p_actor, p_actor_name, 'staff', p_now);
end;
$$;

revoke execute on function public.booking_validate(date, time, int, uuid, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.create_booking(public.booking_channel, date, time, int, text, text, text, text, uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.update_booking(uuid, date, time, int, text, text, text, uuid, text, timestamptz, boolean) from public, anon, authenticated;
revoke execute on function public.change_booking_status(uuid, public.booking_status, uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.assign_tables(uuid, uuid[], text, uuid, text, timestamptz) from public, anon, authenticated;

grant execute on function public.booking_validate(date, time, int, uuid, timestamptz, text) to service_role;
grant execute on function public.create_booking(public.booking_channel, date, time, int, text, text, text, text, uuid, text, timestamptz) to service_role;
grant execute on function public.update_booking(uuid, date, time, int, text, text, text, uuid, text, timestamptz, boolean) to service_role;
grant execute on function public.change_booking_status(uuid, public.booking_status, uuid, text, timestamptz) to service_role;
grant execute on function public.assign_tables(uuid, uuid[], text, uuid, text, timestamptz) to service_role;
