import "server-only";
import { addDays } from "@/lib/booking/format";
import { bangkokNow } from "@/lib/booking/slots";
import { ACTIVE_STATUSES, type BookingStatus } from "@/lib/booking/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { trimSeconds } from "@/lib/store/quota";
import { canCustomerModify } from "./rules";
import type { CustomerSession } from "./session";

export const HISTORY_DAYS = 30;

// CUS-09 / SYS-05: the customer sees what they booked, never the internal end time (EDD), the
// channel or Staff notes. Every column is listed here so nothing else can leak by accident.
export type MyBooking = {
  id: string;
  date: string;
  time: string;
  party: number;
  name: string;
  email: string;
  status: BookingStatus;
  canModify: boolean;
};

const COLUMNS = "id, booking_date, start_time, party_size, customer_name, email, status";

type Row = {
  id: string;
  booking_date: string;
  start_time: string;
  party_size: number;
  customer_name: string;
  email: string | null;
  status: BookingStatus;
};

function toMyBooking(row: Row, now: Date): MyBooking {
  const time = trimSeconds(row.start_time);
  return {
    id: row.id,
    date: row.booking_date,
    time,
    party: row.party_size,
    name: row.customer_name,
    email: row.email ?? "",
    status: row.status,
    canModify: canCustomerModify(row.booking_date, time, row.status, now),
  };
}

// The session proves phone + email. The email is compared here (case-insensitive) rather than
// with ilike, because "_" in an address would act as a wildcard.
function owns(session: CustomerSession, row: { phone: string; email: string | null }): boolean {
  return row.phone === session.phone && row.email?.toLowerCase() === session.email.toLowerCase();
}

export async function loadMyBookings(
  session: CustomerSession,
  now: Date,
): Promise<{ upcoming: MyBooking[]; history: MyBooking[] }> {
  const today = bangkokNow(now).date;
  const { data } = await createAdminClient()
    .from("bookings")
    .select(`${COLUMNS}, phone`)
    .eq("phone", session.phone)
    .gte("booking_date", addDays(today, -HISTORY_DAYS))
    .order("booking_date")
    .order("start_time");

  const mine = ((data ?? []) as (Row & { phone: string })[]).filter((row) => owns(session, row)).map((row) => toMyBooking(row, now));
  return {
    upcoming: mine.filter((b) => ACTIVE_STATUSES.includes(b.status)),
    history: mine.filter((b) => !ACTIVE_STATUSES.includes(b.status)).reverse(),
  };
}

// The one booking a session may act on, or null (not found and not theirs look the same).
export async function loadOwnedBooking(session: CustomerSession, id: string, now: Date): Promise<MyBooking | null> {
  const { data } = await createAdminClient().from("bookings").select(`${COLUMNS}, phone`).eq("id", id).maybeSingle();
  const row = data as (Row & { phone: string }) | null;
  return row && owns(session, row) ? toMyBooking(row, now) : null;
}
