import { config } from "dotenv";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/supabase/database.types";
import { hashOtp } from "../../src/lib/customer/otp";
import { addDays, weekdayOf } from "../../src/lib/booking/format";

config({ path: ".env.local", quiet: true });

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env.local`);
  return value;
}

export const db = createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Every booking the E2E run creates uses a phone in this range, so cleanup never touches real queues.
const PHONE_PREFIX = "0999990";
export const testPhone = (n: number) => `${PHONE_PREFIX}${String(n).padStart(3, "0")}`;
export const testEmail = (n: number) => `e2e+${n}@example.com`;
export const TEST_NAME = "E2E";

export function bangkokToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

// A future open date away from real bookings and from the weekday the hours test closes (Tuesday).
export async function pickTestDate(fromDays: number, avoid: string[] = []): Promise<string> {
  const { data } = await db.from("bookings").select("booking_date").not("phone", "like", `${PHONE_PREFIX}%`);
  const { data: holidays } = await db.from("special_holidays").select("holiday_date");
  const busy = new Set([...(data ?? []).map((r) => r.booking_date), ...(holidays ?? []).map((h) => h.holiday_date), ...avoid]);
  for (let d = fromDays; d < 28; d++) {
    const date = addDays(bangkokToday(), d);
    if (!busy.has(date) && weekdayOf(date) !== 2) return date;
  }
  throw new Error("no free test date in the next 4 weeks");
}

export async function createFixture(n: number, date: string, start: string, party: number, channel: "walk_in" | "phone_in" = "phone_in") {
  const { data, error } = await db.rpc("create_booking", {
    p_actor: null as unknown as string,
    p_actor_name: "E2E",
    p_channel: channel,
    p_date: date,
    p_email: testEmail(n),
    p_name: `${TEST_NAME} ${n}`,
    p_note: "",
    p_now: new Date().toISOString(),
    p_party: party,
    p_phone: testPhone(n),
    p_start: start,
  });
  return { id: data as string | null, error: error?.message ?? null };
}

// The OTP is random and only its HMAC is stored; overwrite it with the hash of a known code.
// The secret is read here inside the test process and never printed.
export async function forceOtp(phone: string, code = "123456") {
  const { error, count } = await db
    .from("customer_otps")
    .update({ code_hash: hashOtp(phone, code, env("SUPABASE_SECRET_KEY")) }, { count: "exact" })
    .eq("phone", phone);
  if (error || count !== 1) throw new Error(`could not set OTP for test phone (${error?.message ?? count})`);
}

export async function cleanupTestData() {
  const like = `${PHONE_PREFIX}%`;
  const { data: rows } = await db.from("bookings").select("id").like("phone", like);
  const ids = (rows ?? []).map((r) => r.id);
  if (ids.length) {
    await db.from("email_outbox").delete().in("booking_id", ids);
    await db.from("bookings").delete().in("id", ids);
  }
  await db.from("email_outbox").delete().like("to_email", "e2e+%@example.com");
  await db.from("customer_otps").delete().like("phone", like);
  await db.from("customer_sessions").delete().like("phone", like);
  await clearLocalRateLimit();
}

// The run books and requests OTPs from localhost far more often than the real per-IP limits allow
// (5 bookings / 10 OTP per 10 minutes). Only the loopback keys are cleared; real visitors' stay.
async function clearLocalRateLimit() {
  const keys = ["::1", "127.0.0.1", "::ffff:127.0.0.1"].map((ip) => createHash("sha256").update(ip).digest("hex"));
  await db.from("booking_attempts").delete().in("key_hash", [...keys, ...keys.map((k) => `otp:${k}`)]);
}

export type StoreSnapshot = {
  hours: Database["public"]["Tables"]["business_hours"]["Row"][];
  holidays: string[];
};

export async function snapshotStore(): Promise<StoreSnapshot> {
  const { data: hours } = await db.from("business_hours").select("*");
  const { data: holidays } = await db.from("special_holidays").select("holiday_date");
  return { hours: hours ?? [], holidays: (holidays ?? []).map((h) => h.holiday_date) };
}

export async function restoreStore(snap: StoreSnapshot) {
  for (const h of snap.hours) {
    await db
      .from("business_hours")
      .update({ is_open: h.is_open, open_time: h.open_time, close_time: h.close_time })
      .eq("weekday", h.weekday);
  }
  const { data: now } = await db.from("special_holidays").select("holiday_date");
  const extra = (now ?? []).map((h) => h.holiday_date).filter((d) => !snap.holidays.includes(d));
  if (extra.length) await db.from("special_holidays").delete().in("holiday_date", extra);
}
