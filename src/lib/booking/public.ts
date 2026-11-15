import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { HoursRow } from "@/lib/store/hours-summary";
import { addDays } from "./format";
import { maxBookingDate, type PublicCalendar } from "./customer-calendar";
import { bangkokNow } from "./slots";

// The public page has no session, so everything it shows is read here with the admin client and
// limited to opening hours and holiday dates: no booking or customer data.

// Shared by the calendar and the footer; cache() makes it one query per request.
export const loadBusinessHours = cache(async (): Promise<HoursRow[]> => {
  const { data } = await createAdminClient().from("business_hours").select("weekday, is_open, open_time, close_time");
  return data ?? [];
});

export async function loadPublicCalendar(now: Date): Promise<PublicCalendar> {
  const today = bangkokNow(now).date;
  const maxDate = maxBookingDate(today);
  const [hours, holidayRes] = await Promise.all([
    loadBusinessHours(),
    createAdminClient().from("special_holidays").select("holiday_date").gte("holiday_date", today).lte("holiday_date", addDays(maxDate, 1)),
  ]);
  return {
    today,
    maxDate,
    openWeekdays: hours.filter((h) => h.is_open && h.open_time && h.close_time).map((h) => h.weekday),
    holidays: (holidayRes.data ?? []).map((h) => h.holiday_date),
  };
}
