import "server-only";
import { trimSeconds } from "@/lib/store/quota";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliverEmail, isEmailConfigured } from "./transport";
import { renderBookingEmail, type BookingEmailKind } from "./templates";

export type ComposedEmail = { to: string; subject: string; body: string; html: string };

// Builds the message for a booking; null when the booking has no email (walk-in / phone-in
// customers who gave none are never notified) or no longer exists.
export async function composeBookingEmail(bookingId: string, kind: BookingEmailKind): Promise<ComposedEmail | null> {
  const { data: booking } = await createAdminClient()
    .from("bookings")
    .select("code, customer_name, email, booking_date, start_time, party_size")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking?.email) return null;
  return {
    to: booking.email,
    ...renderBookingEmail(kind, {
      code: booking.code,
      name: booking.customer_name,
      date: booking.booking_date,
      time: trimSeconds(booking.start_time),
      party: booking.party_size,
    }),
  };
}

// Notifies the customer about a booking change (CUS-12 / STF-07 / STF-08) right away.
// Without GMAIL_USER / GMAIL_APP_PASSWORD nothing is sent: the message is logged to email_outbox
// as "skipped". Never throws: a mail problem must not undo a booking that was already saved.
// The row is written as "sending" (already claimed) so the background queue worker that handles
// "pending" rows (no-show mails, see outbox.ts) can't pick it up and send it twice.
export async function sendBookingEmail(bookingId: string, kind: BookingEmailKind): Promise<void> {
  try {
    const mail = await composeBookingEmail(bookingId, kind);
    if (!mail) return;

    const admin = createAdminClient();
    const configured = isEmailConfigured();
    const { data: row } = await admin
      .from("email_outbox")
      .insert({
        booking_id: bookingId,
        to_email: mail.to,
        template: kind,
        subject: mail.subject,
        body: mail.body,
        status: configured ? "sending" : "skipped",
        claimed_at: configured ? new Date().toISOString() : null,
        error: configured ? null : "ยังไม่ได้ตั้งค่า GMAIL_USER / GMAIL_APP_PASSWORD",
      })
      .select("id")
      .single();
    if (!configured || !row) return;

    try {
      await deliverEmail(mail.to, mail.subject, mail.body, mail.html);
      await admin.from("email_outbox").update({ status: "sent" }).eq("id", row.id);
    } catch (error) {
      await admin
        .from("email_outbox")
        .update({ status: "failed", error: error instanceof Error ? error.message.slice(0, 300) : "send failed" })
        .eq("id", row.id);
    }
  } catch (error) {
    console.error("sendBookingEmail failed", error);
  }
}
