import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";

// System Rule 13 / CUS-08.
export const OTP_TTL_SECONDS = 5 * 60;
export const OTP_RESEND_SECONDS = 60;
export const OTP_MAX_FAILURES = 5;
export const OTP_LOCK_MINUTES = 15;
// How long a verified OTP lets the customer manage bookings before asking again.
export const CUSTOMER_SESSION_MINUTES = 30;

export const NOT_FOUND_MESSAGE = "ไม่พบคิวที่จัดการผ่านเว็บได้ กรุณาติดต่อร้าน";

export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// Keyed with a server secret: with only a million possible codes a plain hash read from the
// database (log, dump, backup) would give the code back at once. Bound to the phone so a code
// can't be replayed against another number.
export function hashOtp(phone: string, code: string, secret: string): string {
  return createHmac("sha256", secret).update(`${phone}:${code}`).digest("hex");
}

export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// somchai@email.com -> so•••••@email.com: enough for the customer to recognise the address.
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "•••••";
  const local = email.slice(0, at);
  return `${local.slice(0, Math.min(2, local.length - 1) || 1)}•••••${email.slice(at)}`;
}
