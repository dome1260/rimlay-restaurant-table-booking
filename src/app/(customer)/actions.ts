"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { fieldErrorsFrom } from "@/lib/action-state";
import { loadSlotOptions, type SlotOptions } from "@/lib/booking/availability";
import { clientKey } from "@/lib/booking/client-key";
import { rpcErrorMessage } from "@/lib/booking/errors";
import { isValidDate } from "@/lib/booking/format";
import { webBookingSchema } from "@/lib/booking/schema";
import { getNow } from "@/lib/clock";
import { sendBookingEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";

// Public page: no login, so nothing here may return customer or booking data. All writes still go
// through create_booking, which re-checks cutoff / quota / one-phone-per-day under a lock.

const ATTEMPT_LIMIT = 5;
const ATTEMPT_WINDOW = "10 minutes";

export type WebBookingState = {
  error?: string;
  fieldErrors?: Record<string, string | undefined>;
  values?: Record<string, string>;
  done?: { date: string; time: string; party: number; name: string; phone: string; email: string };
};

export async function getPublicSlots(input: { date: string; party: number }): Promise<SlotOptions> {
  if (!isValidDate(input.date) || !Number.isInteger(input.party) || input.party < 1 || input.party > 8) {
    return { slots: [], reason: "กรุณาเลือกวันที่และจำนวนที่นั่ง" };
  }
  const { slots, reason } = await loadSlotOptions({
    date: input.date,
    party: input.party,
    now: await getNow(),
    channel: "web",
    client: createAdminClient(),
  });
  return { slots, reason };
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function createWebBooking(_prev: WebBookingState, formData: FormData): Promise<WebBookingState> {
  const values = Object.fromEntries(
    ["date", "time", "party", "name", "phone", "email"].map((key) => [key, text(formData, key)]),
  );

  // Hidden field only bots fill in.
  if (text(formData, "hp_token")) return { error: "ดำเนินการไม่สำเร็จ กรุณาลองใหม่", values };

  const parsed = webBookingSchema.safeParse({ ...values, email: values.email.trim() });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };
  const input = parsed.data;

  const admin = createAdminClient();
  const now = await getNow();
  // No trusted client address (e.g. a local request without proxy headers): skip the limit rather
  // than share one bucket between every customer. The honeypot and the DB rules still apply.
  const key = clientKey(await headers());
  let attemptId: number | null = null;
  if (key) {
    const { data, error: limitError } = await admin.rpc("register_booking_attempt", {
      p_key: key,
      p_now: now.toISOString(),
      p_limit: ATTEMPT_LIMIT,
      p_window: ATTEMPT_WINDOW,
    });
    if (limitError) {
      console.error("booking rate limit failed", limitError);
      return { error: "ดำเนินการไม่สำเร็จ กรุณาลองใหม่", values };
    }
    if (data === null) return { error: "ทำรายการบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่", values };
    attemptId = data;
  }

  const { data: id, error } = await admin.rpc("create_web_booking", {
    p_date: input.date,
    p_start: input.time,
    p_party: input.party,
    p_name: input.name,
    p_phone: input.phone,
    p_email: input.email,
    p_now: now.toISOString(),
  });
  if (error) {
    const message = rpcErrorMessage(error);
    if (!message) console.error("web booking failed", error);
    // A refusal by a booking rule (slot full, cutoff, phone already booked) gives the attempt back,
    // so a genuine customer trying a few busy slots is not locked out. Bots that only spam invalid
    // requests gain nothing: those never create a booking or use quota.
    else if (attemptId !== null) await admin.from("booking_attempts").delete().eq("id", attemptId);
    return { error: message ?? "ดำเนินการไม่สำเร็จ กรุณาลองใหม่", values };
  }

  after(() => sendBookingEmail(id, "created"));
  revalidatePath("/backoffice", "layout");
  return {
    done: { date: input.date, time: input.time, party: input.party, name: input.name, phone: input.phone, email: input.email },
  };
}
