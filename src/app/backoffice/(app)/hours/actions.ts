"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFrom, success, type ActionState } from "@/lib/action-state";
import { affectedByHoliday, affectedByHours, describeHoursChange, type DayHours } from "@/lib/booking/affected";
import { loadOpenBookings } from "@/lib/booking/affected-query";
import { formatThaiDate } from "@/lib/booking/format";
import { getNow } from "@/lib/clock";
import { trimSeconds } from "@/lib/store/quota";
import { bangkokToday, businessHoursSchema, holidaySchema, isPastDate } from "@/lib/store/schema";

const PATH = "/backoffice/hours";

// ADM-08: if open bookings fall on a day that is now closed or outside the new hours, nothing is
// saved until the Admin confirms (confirmed=1). The bookings themselves are never touched.
export async function saveBusinessHours(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");

  const days = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    isOpen: formData.get(`open-${weekday}`) === "on",
    open: String(formData.get(`from-${weekday}`) ?? ""),
    close: String(formData.get(`to-${weekday}`) ?? ""),
  }));
  const parsed = businessHoursSchema.safeParse(days);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const weekday = typeof first.path[0] === "number" ? first.path[0] : null;
    return {
      error: first.message,
      fieldErrors: weekday === null ? {} : { [`day-${weekday}`]: first.message },
    };
  }

  const rows = parsed.data.map((d) => ({
    weekday: d.weekday,
    is_open: d.isOpen,
    open_time: d.isOpen ? d.open : null,
    close_time: d.isOpen ? d.close : null,
  }));
  const supabase = await createClient();

  if (formData.get("confirmed") !== "1") {
    const { data: current } = await supabase.from("business_hours").select("weekday, is_open, open_time, close_time");
    const before: DayHours[] = (current ?? []).map((r) => ({
      weekday: r.weekday,
      isOpen: r.is_open,
      open: r.open_time ? trimSeconds(r.open_time) : "",
      close: r.close_time ? trimSeconds(r.close_time) : "",
    }));
    const after: DayHours[] = parsed.data.map((d) => ({ weekday: d.weekday, isOpen: d.isOpen, open: d.open, close: d.close }));
    const today = bangkokToday(await getNow());
    const bookings = affectedByHours(await loadOpenBookings(today), before, after, today);
    if (bookings.length > 0) return { affected: { summary: describeHoursChange(before, after), bookings } };
  }

  const { error } = await supabase.from("business_hours").upsert(rows, { onConflict: "weekday" });
  if (error) return { error: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };

  revalidatePath(PATH);
  return success();
}

export async function addHoliday(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole("admin");
  const parsed = holidaySchema.safeParse({
    date: String(formData.get("date") ?? ""),
    note: String(formData.get("note") ?? "") || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };
  if (isPastDate(parsed.data.date)) return { fieldErrors: { date: "เลือกวันที่ผ่านมาแล้วไม่ได้" } };

  const supabase = await createClient();
  if (formData.get("confirmed") !== "1") {
    const today = bangkokToday(await getNow());
    const bookings = affectedByHoliday(await loadOpenBookings(today), parsed.data.date, today);
    if (bookings.length > 0) {
      return { affected: { summary: `เพิ่มวันหยุดพิเศษ ${formatThaiDate(parsed.data.date)}`, bookings } };
    }
  }
  const { error } = await supabase
    .from("special_holidays")
    .insert({ holiday_date: parsed.data.date, note: parsed.data.note ?? null, created_by: profile.id });
  if (error) {
    if (error.code === "23505") return { fieldErrors: { date: "มีวันหยุดวันที่นี้อยู่แล้ว" } };
    return { error: "เพิ่มวันหยุดไม่สำเร็จ กรุณาลองใหม่" };
  }
  revalidatePath(PATH);
  return success();
}

export async function removeHoliday(id: string): Promise<ActionState> {
  await requireRole("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("special_holidays").delete().eq("id", id);
  if (error) return { error: "ลบวันหยุดไม่สำเร็จ กรุณาลองใหม่" };
  revalidatePath(PATH);
  return success();
}
