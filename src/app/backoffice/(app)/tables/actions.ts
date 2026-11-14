"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFrom, success, type ActionState } from "@/lib/action-state";
import { affectedByQuota, type AffectedBooking } from "@/lib/booking/affected";
import { AFFECTED_LOAD_ERROR, loadOpenBookings } from "@/lib/booking/affected-query";
import { getNow } from "@/lib/clock";
import { maxQuota } from "@/lib/store/quota";
import { bangkokToday, tableSchema } from "@/lib/store/schema";

const PATH = "/backoffice/tables";

function parse(formData: FormData) {
  return tableSchema.safeParse({ name: formData.get("name") ?? "", seats: formData.get("seats") ?? "" });
}

// ADM-08: bookings that no longer fit once `id` is changed to `next` (inactive or fewer seats).
async function bookingsAffectedByTable(
  id: string,
  next: { seats?: number; is_active?: boolean },
): Promise<AffectedBooking[] | null> {
  const supabase = await createClient();
  const { data: tables } = await supabase.from("dining_tables").select("id, seats, is_active");
  const changed = (tables ?? []).map((t) => (t.id === id ? { ...t, ...next } : t));
  const today = bangkokToday(await getNow());
  const open = await loadOpenBookings(today);
  return open && affectedByQuota(open, maxQuota(changed), today);
}

export async function createTable(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const parsed = parse(formData);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("dining_tables").insert(parsed.data);
  if (error) {
    if (error.code === "23505") return { fieldErrors: { name: "มีโต๊ะชื่อนี้อยู่แล้ว" } };
    return { error: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };
  }
  revalidatePath(PATH);
  return success();
}

export async function updateTable(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const parsed = parse(formData);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  if (formData.get("confirmed") !== "1") {
    const { data: current } = await supabase.from("dining_tables").select("seats, is_active").eq("id", id).maybeSingle();
    if (current?.is_active && parsed.data.seats < current.seats) {
      const bookings = await bookingsAffectedByTable(id, { seats: parsed.data.seats });
      if (!bookings) return { error: AFFECTED_LOAD_ERROR };
      if (bookings.length > 0) {
        return {
          affected: { summary: `ลดที่นั่งโต๊ะ ${parsed.data.name} จาก ${current.seats} เป็น ${parsed.data.seats}`, bookings },
          values: { name: parsed.data.name, seats: String(parsed.data.seats) },
        };
      }
    }
  }
  const { error } = await supabase.from("dining_tables").update(parsed.data).eq("id", id);
  if (error) {
    if (error.code === "23505") return { fieldErrors: { name: "มีโต๊ะชื่อนี้อยู่แล้ว" } };
    return { error: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };
  }
  revalidatePath(PATH);
  return success();
}

export async function setTableActive(id: string, isActive: boolean, confirmed = false): Promise<ActionState> {
  await requireRole("admin");
  if (!isActive && !confirmed) {
    const bookings = await bookingsAffectedByTable(id, { is_active: false });
    if (!bookings) return { error: AFFECTED_LOAD_ERROR };
    if (bookings.length > 0) {
      const { data: table } = await (await createClient()).from("dining_tables").select("name").eq("id", id).maybeSingle();
      return { affected: { summary: `ปิดใช้งานโต๊ะ ${table?.name ?? ""}`.trim(), bookings } };
    }
  }
  const supabase = await createClient();
  const { error } = await supabase.from("dining_tables").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: "เปลี่ยนสถานะไม่สำเร็จ กรุณาลองใหม่" };
  revalidatePath(PATH);
  return success();
}
