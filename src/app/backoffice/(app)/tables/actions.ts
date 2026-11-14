"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { fieldErrorsFrom, success, type ActionState } from "@/lib/action-state";
import { tableSchema } from "@/lib/store/schema";

const PATH = "/backoffice/tables";

function parse(formData: FormData) {
  return tableSchema.safeParse({ name: formData.get("name") ?? "", seats: formData.get("seats") ?? "" });
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
  const { error } = await supabase.from("dining_tables").update(parsed.data).eq("id", id);
  if (error) {
    if (error.code === "23505") return { fieldErrors: { name: "มีโต๊ะชื่อนี้อยู่แล้ว" } };
    return { error: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };
  }
  revalidatePath(PATH);
  return success();
}

// TODO(Phase 2, ADM-08): when deactivating a table, list the future bookings it affects and
// require Admin confirmation before saving. There is no booking data yet, so it saves directly.
export async function setTableActive(id: string, isActive: boolean): Promise<ActionState> {
  await requireRole("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("dining_tables").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: "เปลี่ยนสถานะไม่สำเร็จ กรุณาลองใหม่" };
  revalidatePath(PATH);
  return success();
}
