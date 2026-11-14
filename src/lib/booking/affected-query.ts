import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { OpenBooking } from "./affected";
import { ACTIVE_STATUSES } from "./status";

// Open bookings from `today` onwards, read with the Admin's own session (staff RLS allows it).
export async function loadOpenBookings(today: string): Promise<OpenBooking[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("id, booking_date, start_time, party_size, customer_name, phone, channel, status")
    .gte("booking_date", today)
    .in("status", ACTIVE_STATUSES);
  return (data ?? []) as OpenBooking[];
}
