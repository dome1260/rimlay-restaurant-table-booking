-- Review fix (Phase 4): the public page used to call create_booking with p_actor = null forced past
-- the generated types. A customer-only entry point fixes channel 'web', no actor (the history then
-- shows "customer") and no note, so the page can't pass anything Staff-only.
create or replace function public.create_web_booking(
  p_date date,
  p_start time,
  p_party int,
  p_name text,
  p_phone text,
  p_email text,
  p_now timestamptz
)
returns uuid
language sql
set search_path = ''
as $$
  select public.create_booking('web', p_date, p_start, p_party, p_name, p_phone, p_email, '', null, p_name, p_now);
$$;

revoke all on function public.create_web_booking(date, time, int, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.create_web_booking(date, time, int, text, text, text, timestamptz) to service_role;
