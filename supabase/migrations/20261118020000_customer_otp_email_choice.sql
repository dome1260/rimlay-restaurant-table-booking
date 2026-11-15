-- Review fix (Phase 5): the OTP used to go to the email of the phone's latest booking, whatever its
-- status. Anyone can book with someone else's phone and their own email on a later day, so they
-- would have received every OTP for that phone and locked the real owner out.
-- Now the candidates are the emails of the phone's active upcoming bookings (or, if none, of any
-- booking in the last 30 days, so history stays reachable). With more than one address the
-- customer picks theirs from a masked list (p_choice, 1-based, in the order returned); the session
-- then only covers bookings with that email.
drop function if exists public.request_customer_otp(text, text, timestamptz);

create function public.request_customer_otp(
  p_phone text,
  p_code_hash text,
  p_now timestamptz,
  p_choice int default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_otp public.customer_otps;
  v_has_otp boolean;
  v_emails text[];
  v_email text;
  v_today date := (p_now at time zone 'Asia/Bangkok')::date;
  v_stale boolean;
begin
  perform pg_advisory_xact_lock(hashtext('customer_otp:' || p_phone));

  delete from public.customer_sessions where expires_at < p_now;
  delete from public.customer_otps
  where expires_at < p_now - interval '1 day' and (locked_until is null or locked_until < p_now);

  select * into v_otp from public.customer_otps where phone = p_phone;
  v_has_otp := found;

  if v_has_otp and v_otp.locked_until is not null and v_otp.locked_until > p_now then
    return jsonb_build_object('result', 'locked', 'retry_at', v_otp.locked_until);
  end if;
  if v_has_otp and v_otp.sent_at + interval '60 seconds' > p_now then
    return jsonb_build_object('result', 'too_soon', 'retry_at', v_otp.sent_at + interval '60 seconds');
  end if;

  select array_agg(e order by e) into v_emails
  from (
    select distinct lower(b.email) as e
    from public.bookings b
    where b.phone = p_phone and b.email is not null
      and b.status in ('waiting', 'arrived', 'seated') and b.booking_date >= v_today
  ) s;
  if v_emails is null then
    select array_agg(e order by e) into v_emails
    from (
      select distinct lower(b.email) as e
      from public.bookings b
      where b.phone = p_phone and b.email is not null and b.booking_date >= v_today - 30
    ) s;
  end if;
  if v_emails is null then
    return jsonb_build_object('result', 'not_found');
  end if;

  if array_length(v_emails, 1) > 1 then
    if p_choice is null or p_choice < 1 or p_choice > array_length(v_emails, 1) then
      return jsonb_build_object('result', 'choose', 'emails', to_jsonb(v_emails));
    end if;
    v_email := v_emails[p_choice];
  else
    v_email := v_emails[1];
  end if;

  -- Guesses carry over to a new code while the previous one is still valid; once it has expired
  -- (or the 15 minute lock has passed) the customer starts fresh.
  v_stale := v_has_otp and v_otp.expires_at <= p_now;

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

revoke all on function public.request_customer_otp(text, text, timestamptz, int) from public, anon, authenticated;
grant execute on function public.request_customer_otp(text, text, timestamptz, int) to service_role;
