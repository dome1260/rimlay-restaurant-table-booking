"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFrom, success, type ActionState } from "@/lib/action-state";
import { businessHoursSchema, holidaySchema, isPastDate } from "@/lib/store/schema";

const PATH = "/backoffice/hours";

// TODO(Phase 2, ADM-08): before saving, find future bookings that fall on a closed day or
// outside the new hours and make the Admin confirm the list. No bookings exist yet, so this
// saves directly; the new hours only affect new bookings either way.
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

  // TODO(Phase 2, ADM-08): warn about existing bookings on this date before adding.
  const supabase = await createClient();
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
