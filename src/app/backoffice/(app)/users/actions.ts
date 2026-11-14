"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { fieldErrorsFrom, success, type ActionState } from "@/lib/action-state";
import { createUserSchema, updateUserSchema } from "@/lib/users/schema";
import { canChangeRole, canDeleteFromList, LAST_ADMIN_MESSAGE } from "@/lib/users/rules";
import { countActiveAdmins, softDeleteUser } from "@/lib/users/admin-ops";

const PATH = "/backoffice/users";
const GENERIC = "บันทึกไม่สำเร็จ กรุณาลองใหม่";

function formValues(formData: FormData) {
  return {
    username: String(formData.get("username") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
}

export async function createUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const parsed = createUserSchema.safeParse(formValues(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };
  const { username, displayName, email, role, password } = parsed.data;

  const admin = createAdminClient();
  // Soft-deleted rows keep their username, so this also stops a removed name being reused.
  const { data: taken } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
  if (taken) return { fieldErrors: { username: "ชื่อผู้ใช้นี้ถูกใช้แล้ว" } };

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !created.user) {
    if (authError?.code === "email_exists") return { fieldErrors: { email: "อีเมลนี้ถูกใช้แล้ว" } };
    return { error: GENERIC };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .insert({ id: created.user.id, username, display_name: displayName, email, role });
  if (profileError) {
    // Don't leave an auth user without a profile behind.
    await admin.auth.admin.deleteUser(created.user.id);
    if (profileError.code === "23505") return { fieldErrors: { username: "ชื่อผู้ใช้นี้ถูกใช้แล้ว" } };
    return { error: GENERIC };
  }

  revalidatePath(PATH);
  return success();
}

export async function updateUser(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const parsed = updateUserSchema.safeParse(formValues(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };
  const { displayName, email, role, password } = parsed.data;

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("id, role, email")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!target) return { error: "ไม่พบผู้ใช้นี้" };

  if (!canChangeRole(target, role, await countActiveAdmins())) return { fieldErrors: { role: LAST_ADMIN_MESSAGE } };

  if (email !== target.email || password) {
    const { error: authError } = await admin.auth.admin.updateUserById(id, {
      ...(email !== target.email ? { email, email_confirm: true } : {}),
      ...(password ? { password } : {}),
    });
    if (authError) {
      if (authError.code === "email_exists") return { fieldErrors: { email: "อีเมลนี้ถูกใช้แล้ว" } };
      return { error: GENERIC };
    }
  }

  const { error } = await admin
    .from("profiles")
    .update({ display_name: displayName, email, role })
    .eq("id", id);
  if (error) {
    if (error.message.includes("last_active_admin")) return { fieldErrors: { role: LAST_ADMIN_MESSAGE } };
    return { error: GENERIC };
  }

  revalidatePath(PATH);
  return success();
}

export async function deleteUser(id: string): Promise<ActionState> {
  const actor = await requireRole("admin");
  if (!canDeleteFromList(actor, { id, role: "staff" })) {
    return { error: "ลบบัญชีของตัวเองได้ที่หน้าโปรไฟล์เท่านั้น", severity: "warning" };
  }

  const result = await softDeleteUser(id);
  if (!result.ok) {
    return result.reason === "last_admin"
      ? { error: LAST_ADMIN_MESSAGE, severity: "warning" }
      : { error: "ลบไม่สำเร็จ กรุณาลองใหม่" };
  }

  revalidatePath(PATH);
  return success();
}
