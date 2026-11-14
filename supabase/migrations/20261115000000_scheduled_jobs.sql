-- Phase 3: scheduled closing of bookings (SYS-03 no-show, SYS-04 store closed) and a claim queue
-- for the emails those jobs produce.

create extension if not exists pg_cron with schema pg_catalog;

-- The no-show job only records which customer to mail; Node renders the text with the same
-- templates as every other email, so subject/body may be empty until it is sent.
alter table public.email_outbox
  alter column subject drop not null,
  alter column body drop not null,
  add column claimed_at timestamptz;

alter table public.email_outbox drop constraint email_outbox_status_check;
alter table public.email_outbox
  add constraint email_outbox_status_check
  check (status in ('pending', 'sending', 'sent', 'failed', 'skipped'));

-- Closes bookings that are due. Called every minute by pg_cron with the real clock, and by the
-- dev clock button with the simulated one.
--   SYS-03: still "waiting" 15 minutes after the appointment -> system_closed, customer mailed.
--   SYS-04: not final when the store closes -> system_closed, no email.
-- A day that is now closed / a holiday (ADM-08 never cancels old bookings) has no closing time,
-- so its leftovers close when their own window ends (start + EDD).
-- skip locked: a booking a Staff member is changing right now is simply picked up next minute.
create function public.run_booking_closures(p_now timestamptz default now())
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_no_show int;
  v_closed int;
begin
  with due as (
    select b.id, b.status as old_status
    from public.bookings b
    where b.status = 'waiting' and b.starts_at + interval '15 minutes' <= p_now
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

-- Hands queued emails to exactly one sender. A row stuck in "sending" for 10 minutes (the sender
-- crashed) is offered again.
create function public.claim_pending_emails(p_limit int default 20)
returns table (id bigint, booking_id uuid, to_email text, template text, subject text, body text)
language sql
set search_path = ''
as $$
  with picked as (
    select e.id from public.email_outbox e
    where e.status = 'pending' or (e.status = 'sending' and e.claimed_at < now() - interval '10 minutes')
    order by e.id
    limit p_limit
    for update skip locked
  )
  update public.email_outbox e
  set status = 'sending', claimed_at = now()
  from picked
  where e.id = picked.id
  returning e.id, e.booking_id, e.to_email, e.template, e.subject, e.body;
$$;

revoke execute on function public.run_booking_closures(timestamptz) from public, anon, authenticated;
revoke execute on function public.claim_pending_emails(int) from public, anon, authenticated;
grant execute on function public.run_booking_closures(timestamptz) to service_role;
grant execute on function public.claim_pending_emails(int) to service_role;

select cron.schedule('booking-closures', '* * * * *', $job$select public.run_booking_closures()$job$);
