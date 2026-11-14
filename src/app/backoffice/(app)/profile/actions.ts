"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { BACKOFFICE_LOGIN } from "@/lib/auth/redirect";
import { canDeleteSelf, LAST_ADMIN_MESSAGE } from "@/lib/users/rules";
import { countActiveAdmins, softDeleteUser } from "@/lib/users/admin-ops";
import type { ActionState } from "@/lib/action-state";

// ADM-02: only Admins may remove their own account, and only from this page.
export async function deleteOwnAccount(): Promise<ActionState> {
  const profile = await requireRole("admin");

  if (!canDeleteSelf(profile, await countActiveAdmins())) return { error: LAST_ADMIN_MESSAGE, severity: "warning" };

  const result = await softDeleteUser(profile.id);
  if (!result.ok) {
    return result.reason === "last_admin"
      ? { error: LAST_ADMIN_MESSAGE, severity: "warning" }
      : { error: "ลบไม่สำเร็จ กรุณาลองใหม่" };
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  // The login page shows a success toast for this notice (the session, and any toast, is gone by then).
  redirect(`${BACKOFFICE_LOGIN}?notice=account-deleted`);
}
