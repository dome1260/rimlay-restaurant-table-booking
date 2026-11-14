"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { offsetForBangkokLocal, SIM_CLOCK_COOKIE } from "@/lib/clock-core";
import { getNow } from "@/lib/clock";
import { processPendingEmails } from "@/lib/email/outbox";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEV_TOOLS_REFUSED, devToolsAllowed } from "@/lib/dev-tools";

// Development only: lets cases that need real waiting (cutoff, no-show) be tested by moving
// the app's clock. Refuses outside development so it can't exist in production.
export async function setSimulatedTime(local: string): Promise<{ error?: string }> {
  await requireRole("staff");
  if (!devToolsAllowed()) return { error: DEV_TOOLS_REFUSED };
  const offset = offsetForBangkokLocal(local, new Date());
  if (offset === null) return { error: "รูปแบบวันเวลาไม่ถูกต้อง" };
  (await cookies()).set(SIM_CLOCK_COOKIE, String(offset), { path: "/", sameSite: "lax", httpOnly: true });
  revalidatePath("/backoffice", "layout");
  return {};
}

export async function resetSimulatedTime(): Promise<{ error?: string }> {
  await requireRole("staff");
  if (!devToolsAllowed()) return { error: DEV_TOOLS_REFUSED };
  (await cookies()).delete(SIM_CLOCK_COOKIE);
  revalidatePath("/backoffice", "layout");
  return {};
}

// Development only: runs the same closing job pg_cron runs every minute, but with the simulated
// clock, then sends the emails it queued. pg_cron itself only knows real time.
export async function runScheduledJobs(): Promise<{ error?: string; message?: string }> {
  await requireRole("staff");
  if (!devToolsAllowed()) return { error: DEV_TOOLS_REFUSED };
  const { data, error } = await createAdminClient().rpc("run_booking_closures", { p_now: (await getNow()).toISOString() });
  if (error) return { error: error.message };
  const closed = data as { no_show: number; store_closed: number };
  const mail = await processPendingEmails();
  revalidatePath("/backoffice", "layout");
  return {
    message: `ปิดไม่มาตามนัด ${closed.no_show} · ปิดเมื่อร้านปิด ${closed.store_closed} · อีเมลส่งแล้ว ${mail.sent}${mail.failed ? ` (ล้มเหลว ${mail.failed})` : ""}`,
  };
}
