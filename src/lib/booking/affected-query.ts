import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { OpenBooking } from "./affected";
import { ACTIVE_STATUSES } from "./status";

const PAGE_SIZE = 1000;

export const AFFECTED_LOAD_ERROR = "ตรวจคิวที่ได้รับผลกระทบไม่สำเร็จ ยังไม่ได้บันทึก กรุณาลองใหม่";

// Open bookings from `today` onwards, read with the Admin's own session (staff RLS allows it).
// Paged because PostgREST caps a response at 1000 rows. Returns null on a read error so the
// caller refuses to save: an empty list would skip the ADM-08 warning.
export async function loadOpenBookings(today: string): Promise<OpenBooking[] | null> {
  const supabase = await createClient();
  const rows: OpenBooking[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("bookings")
      .select("id, booking_date, start_time, party_size, customer_name, phone, channel, status")
      .gte("booking_date", today)
      .in("status", ACTIVE_STATUSES)
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      console.error("loadOpenBookings failed", error.message);
      return null;
    }
    rows.push(...((data ?? []) as OpenBooking[]));
    if (data.length < PAGE_SIZE) return rows;
  }
}
