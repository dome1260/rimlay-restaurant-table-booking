import "server-only";
import { trimSeconds } from "@/lib/store/quota";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderBookingEmail, type BookingEmailKind } from "./templates";

// Queues the customer notification for a booking (CUS-12 / STF-07 / STF-08).
// TODO(Phase 2B): real delivery needs Gmail SMTP + Nodemailer. Until GMAIL_USER and
// GMAIL_APP_PASSWORD exist in .env.local nothing is sent: the message is written to
// email_outbox with status "skipped" so the content and trigger points can still be tested.
// Never throws: a mail problem must not undo a booking that was already saved.
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

    const { subject, body } = renderBookingEmail(kind, {
      code: booking.code,
      name: booking.customer_name,
      date: booking.booking_date,
      time: trimSeconds(booking.start_time),
      party: booking.party_size,
    });

    const configured = Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
    await admin.from("email_outbox").insert({
      booking_id: booking.id,
      to_email: booking.email,
      template: kind,
      subject,
      body,
      status: "skipped",
      error: configured ? "ยังไม่ได้ต่อ Nodemailer (Phase 2B)" : "ยังไม่ได้ตั้งค่า GMAIL_USER / GMAIL_APP_PASSWORD",
    });
  } catch (error) {
    console.error("sendBookingEmail failed", error);
  }
}
