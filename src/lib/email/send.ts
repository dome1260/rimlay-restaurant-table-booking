import "server-only";
import { trimSeconds } from "@/lib/store/quota";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliverEmail, isEmailConfigured } from "./transport";
import { renderBookingEmail, type BookingEmailKind } from "./templates";

// Notifies the customer about a booking change (CUS-12 / STF-07 / STF-08).
// Without GMAIL_USER / GMAIL_APP_PASSWORD nothing is sent: the message is logged to email_outbox
// as "skipped". Never throws: a mail problem must not undo a booking that was already saved.
export async function sendBookingEmail(bookingId: string, kind: BookingEmailKind): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: booking } = await admin
      .from("bookings")
      .select("id, code, customer_name, email, booking_date, start_time, party_size")
      .eq("id", bookingId)
      .maybeSingle();
    // Walk-in / phone-in without an email are never notified.
    if (!booking?.email) return;

    const { subject, body, html } = renderBookingEmail(kind, {
      code: booking.code,
      name: booking.customer_name,
      date: booking.booking_date,
      time: trimSeconds(booking.start_time),
      party: booking.party_size,
    });

    const configured = isEmailConfigured();
    const { data: row } = await admin
      .from("email_outbox")
      .insert({
        booking_id: booking.id,
        to_email: booking.email,
        template: kind,
        subject,
        body,
        status: configured ? "pending" : "skipped",
        error: configured ? null : "ยังไม่ได้ตั้งค่า GMAIL_USER / GMAIL_APP_PASSWORD",
      })
      .select("id")
      .single();
    if (!configured || !row) return;

    try {
      await deliverEmail(booking.email, subject, body, html);
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
