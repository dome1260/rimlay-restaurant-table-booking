import type { Database } from "@/lib/supabase/database.types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const ROLE_LABEL: Record<AppRole, string> = {
  staff: "Staff",
  admin: "Admin",
};

// Admin can do everything Staff can (BO-01), so roles form a simple ladder.
const RANK: Record<AppRole, number> = { staff: 1, admin: 2 };

export function hasRole(userRole: AppRole, required: AppRole): boolean {
  return RANK[userRole] >= RANK[required];
}
