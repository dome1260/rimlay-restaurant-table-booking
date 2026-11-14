import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processPendingEmails } from "@/lib/email/outbox";

// Sends the emails queued by the database jobs. Protected by CRON_SECRET (Bearer token).
// TODO(Phase 6): once deployed, have pg_cron + pg_net call this route every minute (keep the URL
// and secret in Supabase Vault). Until then it is only called by hand / the dev "run jobs" button.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const sent = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  const authorised =
    Boolean(secret) && sent.length === expected.length && timingSafeEqual(Buffer.from(sent), Buffer.from(expected));
  if (!authorised) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return NextResponse.json(await processPendingEmails());
}
