-- Phase 5: customers manage their own bookings after an email OTP (CUS-07, CUS-08).
-- Only service_role touches these tables: RLS is on and no policy exists.

-- One row per phone: asking for a new code overwrites the old one, so the old code stops working
-- at once. failed_count is kept across codes so asking again can't reset the guess limit.
create table public.customer_otps (
  phone text primary key,
  email text not null,
  code_hash text,
  sent_at timestamptz not null,
  expires_at timestamptz not null,
  failed_count int not null default 0,
  locked_until timestamptz
);
alter table public.customer_otps enable row level security;

-- Proof of a verified OTP. Scoped to phone + email: the page lists only bookings where both match.
create table public.customer_sessions (
  token_hash text primary key,
  phone text not null,
  email text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index customer_sessions_expires_idx on public.customer_sessions (expires_at);
alter table public.customer_sessions enable row level security;

-- result: sent | not_found | too_soon | locked. "not_found" covers both "no booking" and "only
-- bookings without an email" so the answer never reveals whether a phone has bookings (OQ-11).
create function public.request_customer_otp(p_phone text, p_code_hash text, p_now timestamptz)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_otp public.customer_otps;
  v_email text;
  v_today date := (p_now at time zone 'Asia/Bangkok')::date;
  v_stale boolean;
begin
  perform pg_advisory_xact_lock(hashtext('customer_otp:' || p_phone));

  delete from public.customer_sessions where expires_at < p_now;
  delete from public.customer_otps
  where expires_at < p_now - interval '1 day' and (locked_until is null or locked_until < p_now);

  select * into v_otp from public.customer_otps where phone = p_phone;

  if found and v_otp.locked_until is not null and v_otp.locked_until > p_now then
    return jsonb_build_object('result', 'locked', 'retry_at', v_otp.locked_until);
  end if;
  if found and v_otp.sent_at + interval '60 seconds' > p_now then
    return jsonb_build_object('result', 'too_soon', 'retry_at', v_otp.sent_at + interval '60 seconds');
  end if;

  select b.email into v_email
  from public.bookings b
  where b.phone = p_phone and b.email is not null and b.booking_date >= v_today - 30
  order by b.booking_date desc, b.start_time desc
  limit 1;
  if v_email is null then
    return jsonb_build_object('result', 'not_found');
  end if;

  -- Guesses carry over to a new code while the previous one is still valid; once it has expired
  -- (or the 15 minute lock has passed) the customer starts fresh.
  v_stale := found and v_otp.expires_at <= p_now;

  insert into public.customer_otps (phone, email, code_hash, sent_at, expires_at, failed_count, locked_until)
  values (p_phone, v_email, p_code_hash, p_now, p_now + interval '5 minutes', 0, null)
  on conflict (phone) do update set
    email = excluded.email,
    code_hash = excluded.code_hash,
    sent_at = excluded.sent_at,
    expires_at = excluded.expires_at,
    failed_count = case when v_stale then 0 else public.customer_otps.failed_count end,
    locked_until = null;

  return jsonb_build_object('result', 'sent', 'email', v_email);
end;
$$;

-- result: ok | wrong | expired | locked | no_code. A correct code is used once and creates the session.
create function public.verify_customer_otp(
  p_phone text,
  p_code_hash text,
  p_now timestamptz,
  p_session_hash text,
  p_session_expires timestamptz
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_otp public.customer_otps;
  v_failed int;
begin
  perform pg_advisory_xact_lock(hashtext('customer_otp:' || p_phone));

  select * into v_otp from public.customer_otps where phone = p_phone;
  if not found then
    return jsonb_build_object('result', 'no_code');
  end if;

  if v_otp.locked_until is not null and v_otp.locked_until > p_now then
    return jsonb_build_object('result', 'locked', 'retry_at', v_otp.locked_until);
  end if;
  if v_otp.code_hash is null or v_otp.expires_at <= p_now then
    return jsonb_build_object('result', 'expired');
  end if;

  if v_otp.code_hash <> p_code_hash then
    v_failed := v_otp.failed_count + 1;
    if v_failed >= 5 then
      update public.customer_otps
      set failed_count = v_failed, locked_until = p_now + interval '15 minutes', code_hash = null
      where phone = p_phone;
      return jsonb_build_object('result', 'locked', 'retry_at', p_now + interval '15 minutes');
    end if;
    update public.customer_otps set failed_count = v_failed where phone = p_phone;
    return jsonb_build_object('result', 'wrong', 'remaining', 5 - v_failed);
  end if;

  delete from public.customer_otps where phone = p_phone;
  insert into public.customer_sessions (token_hash, phone, email, expires_at, created_at)
  values (p_session_hash, p_phone, v_otp.email, p_session_expires, p_now);
  return jsonb_build_object('result', 'ok');
end;
$$;

revoke all on function public.request_customer_otp(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.request_customer_otp(text, text, timestamptz) to service_role;
revoke all on function public.verify_customer_otp(text, text, timestamptz, text, timestamptz) from public, anon, authenticated;
grant execute on function public.verify_customer_otp(text, text, timestamptz, text, timestamptz) to service_role;
