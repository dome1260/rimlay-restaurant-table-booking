import "server-only";
import { cookies } from "next/headers";
import { getNow } from "@/lib/clock";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "./otp";

export const CUSTOMER_COOKIE = "rimlay-customer-session";

export type CustomerSession = { phone: string; email: string };

// Customers have no account. A verified OTP (verify_customer_otp) stores a hashed token for
// phone + email, and this cookie carries the raw token. It is a session cookie (no maxAge) and
// the row expires after CUSTOMER_SESSION_MINUTES, measured on the same clock as the OTP.
export async function getCustomerSession(): Promise<CustomerSession | null> {
  const token = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;
  const { data } = await createAdminClient()
    .from("customer_sessions")
    .select("phone, email")
    .eq("token_hash", hashToken(token))
    .gt("expires_at", (await getNow()).toISOString())
    .maybeSingle();
  return data;
}

export async function setCustomerCookie(token: string): Promise<void> {
  (await cookies()).set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function endCustomerSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(CUSTOMER_COOKIE)?.value;
  if (token) await createAdminClient().from("customer_sessions").delete().eq("token_hash", hashToken(token));
  store.delete(CUSTOMER_COOKIE);
}
