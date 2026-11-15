import { CUTOFF_MINUTES } from "@/lib/booking/slots";
import type { BookingStatus } from "@/lib/booking/status";

// CUS-10 / CUS-11, System Rule 7: customers edit or cancel only a waiting booking, up to 15
// minutes before the appointment. Compared to the millisecond like update_web_booking /
// cancel_web_booking (starts_at - 15 min >= now), so the buttons never show while the database
// would already refuse. Display only: the database checks again.
export function canCustomerModify(date: string, time: string, status: BookingStatus, now: Date): boolean {
  if (status !== "waiting") return false;
  const startsAt = Date.parse(`${date}T${time}:00+07:00`);
  return startsAt - CUTOFF_MINUTES * 60_000 >= now.getTime();
}
