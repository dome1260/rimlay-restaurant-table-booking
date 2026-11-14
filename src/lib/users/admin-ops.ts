import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Effectively permanent; Supabase Auth has no "disabled" flag, so a ban is how a removed
// account is kept from signing in again.
const BAN_FOREVER = "876000h";

export async function countActiveAdmins(): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .is("deleted_at", null);
  return count ?? 0;
}

export type SoftDeleteResult = { ok: true } | { ok: false; reason: "last_admin" | "failed" };

// Marks the profile deleted first: the DB trigger refuses to remove the last active Admin
// (even under concurrent requests), and only then is the auth user banned.
export async function softDeleteUser(userId: string): Promise<SoftDeleteResult> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", userId)
    .is("deleted_at", null);
  if (error) return { ok: false, reason: error.message.includes("last_active_admin") ? "last_admin" : "failed" };

  const { error: banError } = await admin.auth.admin.updateUserById(userId, { ban_duration: BAN_FOREVER });
  // The profile is already marked deleted, which the DAL treats as no access, so a failed
  // ban still leaves the account unusable; report success.
  if (banError) console.error("softDeleteUser: failed to ban auth user", userId, banError.message);
  return { ok: true };
}
