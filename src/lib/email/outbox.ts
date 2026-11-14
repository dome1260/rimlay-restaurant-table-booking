import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { composeBookingEmail } from "./send";
import type { BookingEmailKind } from "./templates";
import { deliverEmail, isEmailConfigured } from "./transport";

export type OutboxResult = { sent: number; failed: number; skipped: number };

// Sends the mails queued by the database (currently the no-show notice from the scheduled job).
// claim_pending_emails marks rows "sending" under a lock, so overlapping runs never send twice.
export async function processPendingEmails(limit = 20): Promise<OutboxResult> {
  const admin = createAdminClient();
  const result: OutboxResult = { sent: 0, failed: 0, skipped: 0 };
  const { data: rows, error } = await admin.rpc("claim_pending_emails", { p_limit: limit });
  if (error) throw new Error(error.message);

  const configured = isEmailConfigured();
  for (const row of rows ?? []) {
    // A failed status write must be loud: a row left in "sending" is offered again after 10
    // minutes and the customer would get the email twice.
    const settle = async (
      status: "sent" | "failed" | "skipped",
      note: string | null,
      mail?: { subject: string; body: string },
    ) => {
      const { error: updateError } = await admin
        .from("email_outbox")
        .update({ status, error: note, ...(mail ? { subject: mail.subject, body: mail.body } : {}) })
        .eq("id", row.id);
      if (updateError) console.error("email_outbox update failed", row.id, updateError.message);
    };
    try {
      const mail = row.booking_id ? await composeBookingEmail(row.booking_id, row.template as BookingEmailKind) : null;
      if (!mail) {
        await settle("failed", "ไม่พบคิวหรือคิวไม่มีอีเมล");
        result.failed += 1;
        continue;
      }
      if (!configured) {
        await settle("skipped", "ยังไม่ได้ตั้งค่า GMAIL_USER / GMAIL_APP_PASSWORD", mail);
        result.skipped += 1;
        continue;
      }
      await deliverEmail(row.to_email, mail.subject, mail.body, mail.html);
      await settle("sent", null, mail);
      result.sent += 1;
    } catch (failure) {
      await settle("failed", failure instanceof Error ? failure.message.slice(0, 300) : "send failed");
      result.failed += 1;
    }
  }
  return result;
}
