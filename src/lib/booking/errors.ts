// The RPCs raise short codes (see supabase/migrations/*_bookings.sql); this turns them into Thai
// messages. Unknown codes return null so callers can show a generic failure.
const MESSAGES: Record<string, string> = {
  date_range: "เลือกวันที่ได้ตั้งแต่วันนี้ถึงล่วงหน้าไม่เกิน 1 เดือน",
  holiday: "วันที่เลือกเป็นวันหยุดพิเศษ ร้านปิดทั้งวัน",
  closed_day: "ร้านไม่เปิดทำการในวันที่เลือก",
  bad_slot: "เวลาที่เลือกอยู่นอกช่วงที่รับจอง",
  past_cutoff: "ปิดรับจองแล้ว (ปิดรับก่อนเริ่ม slot 15 นาที)",
  slot_passed: "slot นี้ผ่านไปแล้ว กรุณาเลือกเวลาอื่น",
  no_quota: "ที่นั่งช่วงเวลานี้ไม่พอ กรุณาเลือกเวลาหรือจำนวนที่นั่งอื่น",
  phone_daily_limit: "เบอร์นี้มีคิวในวันที่เลือกแล้ว — 1 เบอร์จองได้ 1 คิวต่อวัน",
  bad_status: "คิวนี้ถึงสถานะสุดท้ายแล้ว แก้ไขไม่ได้",
  bad_transition: "สถานะของคิวเปลี่ยนไปแล้ว กรุณารีเฟรชหน้า",
  not_found: "ไม่พบคิวนี้",
  no_tables: "กรุณาเลือกโต๊ะอย่างน้อย 1 โต๊ะ",
  table_inactive: "โต๊ะที่เลือกถูกปิดใช้งาน กรุณารีเฟรชหน้า",
  table_busy: "โต๊ะที่เลือกมีลูกค้าใช้อยู่ กรุณารีเฟรชหน้า",
};

export function rpcErrorMessage(error: { message?: string } | null | undefined): string | null {
  const code = error?.message?.trim();
  return code && code in MESSAGES ? MESSAGES[code] : null;
}

export function isRpcRefusal(error: { message?: string } | null | undefined): boolean {
  return rpcErrorMessage(error) !== null;
}
