import "server-only";
import { OTP_TTL_SECONDS } from "@/lib/customer/otp";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeHtml } from "./templates";
import { deliverEmail, isEmailConfigured } from "./transport";

const SUBJECT = "รหัส OTP สำหรับจัดการคิว Rimlay";

function render(code: string): { body: string; html: string } {
  const minutes = OTP_TTL_SECONDS / 60;
  const lines = [
    "สวัสดี",
    "",
    `รหัส OTP สำหรับดูและจัดการคิวของคุณคือ ${code}`,
    `รหัสมีอายุ ${minutes} นาที และใช้ได้ครั้งเดียว`,
    "หากคุณไม่ได้ขอรหัสนี้ ไม่ต้องดำเนินการใด ๆ และอย่าบอกรหัสกับใคร",
    "",
    "Rimlay",
  ];
  const html = [
    '<div style="font-family:system-ui,sans-serif;color:#1c1917;line-height:1.6">',
    "<p>สวัสดี</p>",
    "<p>รหัส OTP สำหรับดูและจัดการคิวของคุณคือ</p>",
    `<p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:8px 0">${escapeHtml(code)}</p>`,
    `<p>รหัสมีอายุ ${minutes} นาที และใช้ได้ครั้งเดียว</p>`,
    "<p>หากคุณไม่ได้ขอรหัสนี้ ไม่ต้องดำเนินการใด ๆ และอย่าบอกรหัสกับใคร</p>",
    "<p>Rimlay</p>",
    "</div>",
  ].join("");
  return { body: lines.join("\n"), html };
}

// Sends the OTP. Returns false when it could not be delivered, so the customer is told instead of
// waiting for a mail that never comes. The log row in email_outbox never holds the code itself.
// In development without Gmail credentials the code is printed to the server log (TODO: nothing
// sends it until GMAIL_USER / GMAIL_APP_PASSWORD exist; production without them fails here).
export async function sendOtpEmail(to: string, code: string): Promise<boolean> {
  const configured = isEmailConfigured();
  const devFallback = !configured && process.env.NODE_ENV !== "production";
  let status: "sent" | "failed" | "skipped" = "sent";
  let error: string | null = null;

  if (configured) {
    try {
      const { body, html } = render(code);
      await deliverEmail(to, SUBJECT, body, html);
    } catch (failure) {
      status = "failed";
      error = failure instanceof Error ? failure.message.slice(0, 300) : "send failed";
    }
  } else {
    status = "skipped";
    error = "ยังไม่ได้ตั้งค่า GMAIL_USER / GMAIL_APP_PASSWORD";
    if (devFallback) console.info(`[dev] OTP for ${to}: ${code}`);
  }

  const { error: logError } = await createAdminClient().from("email_outbox").insert({
    to_email: to,
    template: "otp",
    subject: SUBJECT,
    body: "ส่งรหัส OTP (ไม่เก็บรหัสในบันทึก)",
    status,
    error,
  });
  if (logError) console.error("sendOtpEmail: outbox insert failed", logError.message);
  return status === "sent" || devFallback;
}
