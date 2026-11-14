import { formatThaiDate } from "@/lib/booking/format";

export type BookingEmailKind = "created" | "edited" | "cancelled";

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
};

const LEAD: Record<BookingEmailKind, string> = {
  created: "ขอบคุณที่จองโต๊ะกับ Rimlay การจองของคุณสำเร็จแล้ว",
  edited: "การจองของคุณได้รับการแก้ไข รายละเอียดล่าสุดมีดังนี้",
  cancelled: "การจองของคุณถูกยกเลิกแล้ว รายละเอียดของคิวที่ยกเลิกมีดังนี้",
};

// SYS-05 / TC-107: only the appointment time is shown, never the internal EDD end time.
export function renderBookingEmail(kind: BookingEmailKind, data: BookingEmailData): { subject: string; body: string } {
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
  return { subject: SUBJECT[kind], body: lines.join("\n") };
}
