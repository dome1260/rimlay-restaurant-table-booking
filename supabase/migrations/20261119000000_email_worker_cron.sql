-- Phase 6: emails queued by the database (no-show) are sent by POST /api/jobs/emails on Vercel.
-- pg_cron calls it every minute through pg_net, only when something is waiting, so an idle shop
-- costs no function invocations. The URL and CRON_SECRET live in Supabase Vault, never in SQL files.
create extension if not exists pg_net with schema extensions;

create or replace function public.run_email_worker()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (
    select 1 from public.email_outbox e
    where e.status = 'pending' or (e.status = 'sending' and e.claimed_at < now() - interval '10 minutes')
  ) then
    return;
  end if;

  select s.decrypted_secret into v_url from vault.decrypted_secrets s where s.name = 'jobs_url';
  select s.decrypted_secret into v_secret from vault.decrypted_secrets s where s.name = 'cron_secret';
  -- TODO(deploy): nothing is sent until the Vault secrets 'jobs_url' (https://<production>/api/jobs/emails)
  -- and 'cron_secret' (same value as CRON_SECRET on Vercel) are created in the Supabase SQL editor.
  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$$;

revoke all on function public.run_email_worker() from public, anon, authenticated;

select cron.schedule('email-worker', '* * * * *', $job$select public.run_email_worker()$job$);
