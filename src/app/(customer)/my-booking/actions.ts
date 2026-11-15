"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { fieldErrorsFrom, formText } from "@/lib/action-state";
import { loadSlotOptions, type SlotOptions } from "@/lib/booking/availability";
import { clientKey } from "@/lib/booking/client-key";
import { rpcErrorMessage } from "@/lib/booking/errors";
import { isValidDate } from "@/lib/booking/format";
import { isValidPhone, normalizePhone } from "@/lib/booking/phone";
import { myBookingEditSchema } from "@/lib/booking/schema";
import { getNow } from "@/lib/clock";
import {
  CUSTOMER_SESSION_MINUTES,
  NOT_FOUND_MESSAGE,
  OTP_MAX_FAILURES,
  OTP_RESEND_SECONDS,
  OTP_TTL_SECONDS,
  generateOtp,
  hashOtp,
  hashToken,
  maskEmail,
  newSessionToken,
} from "@/lib/customer/otp";
import { loadOwnedBooking } from "@/lib/customer/bookings";
import { endCustomerSession, getCustomerSession, setCustomerCookie } from "@/lib/customer/session";
import { sendBookingEmail } from "@/lib/email/send";
import { sendOtpEmail } from "@/lib/email/otp-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabaseSecretKey } from "@/lib/supabase/env";

// Public page without an account: everything here is gated by an OTP (phone + email) or by the
// session it creates. The database re-checks ownership and the 15 minute rule on every write.

const PHONE_ERROR = "เบอร์โทรศัพท์ต้องเป็นมือถือไทย 10 หลัก ขึ้นต้น 06 / 08 / 09";
const GENERIC_ERROR = "ดำเนินการไม่สำเร็จ กรุณาลองใหม่";
const OTP_IP_LIMIT = 10;
const OTP_IP_WINDOW = "10 minutes";
const SESSION_EXPIRED = "หมดเวลาการใช้งาน กรุณาขอรหัส OTP ใหม่";
const TOO_LATE_MESSAGE = "คิวนี้แก้ไขไม่ได้แล้ว (เหลือน้อยกว่า 15 นาทีก่อนเวลานัด หรือสถานะเปลี่ยนไปแล้ว) กรุณารีเฟรชหน้า";

function lockedMessage(): string {
  return `เบอร์นี้ถูกล็อกชั่วคราว เนื่องจากกรอกรหัสผิดครบ ${OTP_MAX_FAILURES} ครั้ง`;
}

function secondsUntil(iso: unknown, now: Date): number {
  const ms = typeof iso === "string" ? Date.parse(iso) - now.getTime() : 0;
  return Math.max(1, Math.ceil(ms / 1000));
}

type OtpRpc = { result?: string; email?: string; emails?: string[]; retry_at?: string; remaining?: number };

export type RequestOtpResult =
  | { ok: true; maskedEmail: string; expiresIn: number; resendIn: number }
  // retryIn is in seconds (not a timestamp) so it stays right under the simulated dev clock.
  | { ok: false; error: string; retryIn?: number; locked?: boolean }
  // The phone's bookings use several emails: the customer picks theirs (1-based index in this
  // list) and asks again. Only masked addresses leave the server.
  | { ok: false; choose: string[] };

export async function requestOtp(phoneInput: string, choice?: number): Promise<RequestOtpResult> {
  const phone = normalizePhone(phoneInput);
  if (!isValidPhone(phone)) return { ok: false, error: PHONE_ERROR };

  const admin = createAdminClient();
  const now = await getNow();

  const key = clientKey(await headers());
  if (key) {
    const { data, error } = await admin.rpc("register_booking_attempt", {
      p_key: `otp:${key}`,
      p_now: now.toISOString(),
      p_limit: OTP_IP_LIMIT,
      p_window: OTP_IP_WINDOW,
    });
    if (error) {
      console.error("otp rate limit failed", error);
      return { ok: false, error: GENERIC_ERROR };
    }
    if (data === null) return { ok: false, error: "ทำรายการบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" };
  }

  const code = generateOtp();
  const { data, error } = await admin.rpc("request_customer_otp", {
    p_phone: phone,
    p_code_hash: hashOtp(phone, code, supabaseSecretKey()),
    p_now: now.toISOString(),
    p_choice: choice,
  });
  if (error) {
    console.error("request_customer_otp failed", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  const out = (data ?? {}) as OtpRpc;
  if (out.result === "not_found") return { ok: false, error: NOT_FOUND_MESSAGE };
  if (out.result === "choose" && out.emails) return { ok: false, choose: out.emails.map(maskEmail) };
  if (out.result === "locked") {
    return { ok: false, error: lockedMessage(), locked: true, retryIn: secondsUntil(out.retry_at, now) };
  }
  if (out.result === "too_soon") {
    const retryIn = secondsUntil(out.retry_at, now);
    return { ok: false, error: `ขอรหัสได้ทุก ${OTP_RESEND_SECONDS} วินาที กรุณารอสักครู่`, retryIn };
  }
  if (out.result !== "sent" || !out.email) return { ok: false, error: GENERIC_ERROR };

  if (!(await sendOtpEmail(out.email, code))) {
    return { ok: false, error: "ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
  return { ok: true, maskedEmail: maskEmail(out.email), expiresIn: OTP_TTL_SECONDS, resendIn: OTP_RESEND_SECONDS };
}

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; error: string; locked?: boolean; retryIn?: number; expired?: boolean };

export async function verifyOtp(phoneInput: string, codeInput: string): Promise<VerifyOtpResult> {
  const phone = normalizePhone(phoneInput);
  const code = codeInput.trim();
  if (!isValidPhone(phone)) return { ok: false, error: PHONE_ERROR };
  if (!/^\d{6}$/.test(code)) return { ok: false, error: "กรุณากรอกรหัส OTP 6 หลัก" };

  const now = await getNow();
  const token = newSessionToken();
  const { data, error } = await createAdminClient().rpc("verify_customer_otp", {
    p_phone: phone,
    p_code_hash: hashOtp(phone, code, supabaseSecretKey()),
    p_now: now.toISOString(),
    p_session_hash: hashToken(token),
    p_session_expires: new Date(now.getTime() + CUSTOMER_SESSION_MINUTES * 60_000).toISOString(),
  });
  if (error) {
    console.error("verify_customer_otp failed", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  const out = (data ?? {}) as OtpRpc;
  if (out.result === "ok") {
    await setCustomerCookie(token);
    return { ok: true };
  }
  if (out.result === "wrong") {
    const remaining = out.remaining ?? 0;
    return {
      ok: false,
      error: `รหัสไม่ถูกต้อง เหลืออีก ${remaining} ครั้ง หากผิดครบ ${OTP_MAX_FAILURES} ครั้ง เบอร์นี้จะถูกล็อก 15 นาที`,
    };
  }
  if (out.result === "locked") {
    return { ok: false, error: lockedMessage(), locked: true, retryIn: secondsUntil(out.retry_at, now) };
  }
  return { ok: false, error: "รหัสหมดอายุหรือไม่ถูกต้อง กรุณาขอรหัสใหม่", expired: true };
}

export async function signOutCustomer(): Promise<void> {
  await endCustomerSession();
  revalidatePath("/my-booking");
}

export async function getMyEditSlots(input: { bookingId: string; date: string; party: number }): Promise<SlotOptions> {
  const session = await getCustomerSession();
  if (!session) return { slots: [], reason: SESSION_EXPIRED };
  if (!isValidDate(input.date) || !Number.isInteger(input.party) || input.party < 1 || input.party > 8) {
    return { slots: [], reason: "กรุณาเลือกวันที่และจำนวนที่นั่ง" };
  }
  const now = await getNow();
  const booking = await loadOwnedBooking(session, input.bookingId, now);
  if (!booking) return { slots: [], reason: "ไม่พบคิวนี้" };
  if (!booking.canModify) return { slots: [], reason: TOO_LATE_MESSAGE };

  const { slots, reason } = await loadSlotOptions({
    date: input.date,
    party: input.party,
    now,
    excludeId: input.bookingId,
    rule: "cutoff",
    client: createAdminClient(),
  });
  return { slots, reason };
}

export type MyEditState = {
  error?: string;
  fieldErrors?: Record<string, string | undefined>;
  values?: Record<string, string>;
  expired?: boolean;
  done?: { emailChanged: boolean; email: string };
};

export async function updateMyBooking(_prev: MyEditState, formData: FormData): Promise<MyEditState> {
  const values = Object.fromEntries(["date", "time", "party", "name", "email"].map((key) => [key, formText(formData, key)]));
  const session = await getCustomerSession();
  if (!session) return { error: SESSION_EXPIRED, expired: true, values };

  const parsed = myBookingEditSchema.safeParse({ ...values, email: values.email.trim() });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error), values };
  const input = parsed.data;

  const bookingId = formText(formData, "bookingId");
  const now = await getNow();
  const before = await loadOwnedBooking(session, bookingId, now);
  if (!before) return { error: "ไม่พบคิวนี้", values };

  const { error } = await createAdminClient().rpc("update_web_booking", {
    p_id: bookingId,
    p_phone: session.phone,
    p_owner_email: session.email,
    p_date: input.date,
    p_start: input.time,
    p_party: input.party,
    p_name: input.name,
    p_email: input.email,
    p_now: now.toISOString(),
  });
  if (error) {
    const message = rpcErrorMessage(error);
    if (!message) console.error("update_web_booking failed", error);
    return { error: message ?? GENERIC_ERROR, values };
  }

  const changed =
    before.date !== input.date ||
    before.time !== input.time ||
    before.party !== input.party ||
    before.name !== input.name ||
    before.email !== input.email;
  // CUS-12: the customer is told about every change that was actually made. The mail goes to the
  // address now on the booking.
  if (changed) after(() => sendBookingEmail(bookingId, "edited"));
  revalidatePath("/backoffice", "layout");
  return { done: { emailChanged: before.email.toLowerCase() !== input.email.toLowerCase(), email: input.email } };
}

export type CancelMyResult = { ok: true } | { ok: false; error: string; expired?: boolean };

export async function cancelMyBooking(bookingId: string): Promise<CancelMyResult> {
  const session = await getCustomerSession();
  if (!session) return { ok: false, error: SESSION_EXPIRED, expired: true };

  const { error } = await createAdminClient().rpc("cancel_web_booking", {
    p_id: bookingId,
    p_phone: session.phone,
    p_owner_email: session.email,
    p_now: (await getNow()).toISOString(),
  });
  if (error) {
    const message = rpcErrorMessage(error);
    if (!message) console.error("cancel_web_booking failed", error);
    return { ok: false, error: message ?? GENERIC_ERROR };
  }

  after(() => sendBookingEmail(bookingId, "cancelled"));
  revalidatePath("/backoffice", "layout");
  return { ok: true };
}
