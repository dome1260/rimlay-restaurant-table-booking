import { formatThaiDate } from "@/lib/booking/format";

export type BookingEmailKind = "created" | "edited" | "cancelled" | "no_show";

export type BookingEmailData = {
  code: string;
  name: string;
  date: string;
  time: string;
  party: number;
};

const SUBJECT: Record<BookingEmailKind, string> = {
  created: "ยืนยันการจองโต๊ะ Rimlay",
  edited: "การจองโต๊ะของคุณมีการเปลี่ยนแปลง",
  cancelled: "การจองโต๊ะของคุณถูกยกเลิก",
  no_show: "การจองโต๊ะของคุณถูกปิดเนื่องจากไม่มาตามเวลานัด",
};

const LEAD: Record<BookingEmailKind, string> = {
  created: "ขอบคุณที่จองโต๊ะกับ Rimlay การจองของคุณสำเร็จแล้ว",
  edited: "การจองของคุณได้รับการแก้ไข รายละเอียดล่าสุดมีดังนี้",
  cancelled: "การจองของคุณถูกยกเลิกแล้ว รายละเอียดของคิวที่ยกเลิกมีดังนี้",
  no_show: "คิวของคุณถูกปิดโดยระบบ เนื่องจากไม่ได้มาถึงร้านภายใน 15 นาทีหลังเวลานัด รายละเอียดของคิวมีดังนี้",
};

// SYS-05 / TC-107: only the appointment time is shown, never the internal EDD end time.
export function renderBookingEmail(
  kind: BookingEmailKind,
  data: BookingEmailData,
): { subject: string; body: string; html: string } {
  const lines = [
    `สวัสดีคุณ ${data.name}`,
    "",
    LEAD[kind],
    "",
    `รหัสการจอง: ${data.code}`,
    `วันที่: ${formatThaiDate(data.date)}`,
    `เวลา: ${data.time} น.`,
    `จำนวนที่นั่ง: ${data.party} ท่าน`,
    "",
    "Rimlay",
  ];
  return { subject: SUBJECT[kind], body: lines.join("\n"), html: renderHtml(kind, data) };
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderHtml(kind: BookingEmailKind, data: BookingEmailData): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 16px 4px 0;color:#57534e">${label}</td><td style="padding:4px 0;font-weight:600">${escapeHtml(value)}</td></tr>`;
  return [
    '<div style="font-family:system-ui,sans-serif;color:#1c1917;line-height:1.6">',
    `<p>สวัสดีคุณ ${escapeHtml(data.name)}</p>`,
    `<p>${LEAD[kind]}</p>`,
    "<table>",
    row("รหัสการจอง", data.code),
    row("วันที่", formatThaiDate(data.date)),
    row("เวลา", `${data.time} น.`),
    row("จำนวนที่นั่ง", `${data.party} ท่าน`),
    "</table>",
    "<p>Rimlay</p>",
    "</div>",
  ].join("");
}
