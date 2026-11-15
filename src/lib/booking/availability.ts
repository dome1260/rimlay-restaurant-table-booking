import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { maxQuota, trimSeconds } from "@/lib/store/quota";
import { addMonths, weekdayOf } from "./format";
import { availableSlots, type LoadBooking } from "./quota";
import { bangkokNow, currentSlot, generateSlots, isSlotBookable, timeRuleFor, type TimeRule } from "./slots";
import type { BookingChannel } from "./status";

export type SlotOptions = {
  slots: string[];
  // Why the day offers nothing (shown instead of the slot grid).
  reason?: string;
  defaultSlot?: string;
};

// Mirrors booking_validate() in the database so the form only offers slots the RPC would accept.
// The RPC still re-checks everything under a lock; this is for display.
export async function loadSlotOptions(params: {
  date: string;
  party: number;
  now: Date;
  channel?: BookingChannel;
  // Editing an existing booking: it doesn't count against itself and Staff skip the cutoff.
  excludeId?: string;
  // The public booking page has no session, so it passes the admin client; the default is the
  // signed-in Staff session (RLS).
  client?: SupabaseClient<Database>;
  // A customer editing their own booking follows the web cutoff, unlike Staff edits.
  rule?: TimeRule;
}): Promise<SlotOptions> {
  const { date, party, now, channel, excludeId } = params;
  const today = bangkokNow(now).date;
  if (date < today || date > addMonths(today, 1)) {
    return { slots: [], reason: "เลือกวันที่ได้ตั้งแต่วันนี้ถึงล่วงหน้าไม่เกิน 1 เดือน" };
  }

  const supabase = params.client ?? (await createClient());
  const [hoursRes, holidayRes, tablesRes, bookingsRes] = await Promise.all([
    supabase.from("business_hours").select("is_open, open_time, close_time").eq("weekday", weekdayOf(date)).maybeSingle(),
    supabase.from("special_holidays").select("id").eq("holiday_date", date).maybeSingle(),
    supabase.from("dining_tables").select("seats, is_active"),
    supabase.from("bookings").select("id, start_time, party_size, status").eq("booking_date", date),
  ]);

  if (holidayRes.data) return { slots: [], reason: "วันที่เลือกเป็นวันหยุดพิเศษ ร้านปิดทั้งวัน" };
  const hours = hoursRes.data;
  if (!hours?.is_open || !hours.open_time || !hours.close_time) {
    return { slots: [], reason: "ร้านไม่เปิดทำการในวันที่เลือก" };
  }

  const rule: TimeRule = params.rule ?? (excludeId ? "edit" : timeRuleFor(channel ?? "phone_in"));
  const all = generateSlots(trimSeconds(hours.open_time), trimSeconds(hours.close_time));
  const timely = all.filter((slot) => isSlotBookable(date, slot, now, rule));
  const bookings: LoadBooking[] = (bookingsRes.data ?? []).map((b) => ({ ...b, start_time: trimSeconds(b.start_time) }));
  const slots = availableSlots(timely, bookings, party, maxQuota(tablesRes.data ?? []), excludeId);

  if (slots.length === 0) return { slots, reason: "ไม่มี slot ว่างสำหรับจำนวนที่นั่งนี้" };

  // Walk-in default: the slot that is running now, when it is still available.
  const running = currentSlot(now);
  const defaultSlot = date === today && slots.includes(running) ? running : undefined;
  return { slots, defaultSlot };
}
