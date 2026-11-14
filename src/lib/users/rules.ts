import type { AppRole } from "@/lib/auth/roles";

type Person = { id: string; role: AppRole };

// TC-078 / ADM-01: the user list never lets you delete your own row.
export function canDeleteFromList(actor: Person, target: Person): boolean {
  return actor.id !== target.id;
}

// TC-108 / OQ-15: the system must always keep at least one active Admin.
export function canDeleteSelf(actor: Person, activeAdminCount: number): boolean {
  return !(actor.role === "admin" && activeAdminCount <= 1);
}

export function canChangeRole(target: Person, newRole: AppRole, activeAdminCount: number): boolean {
  if (target.role === "admin" && newRole !== "admin") return activeAdminCount > 1;
  return true;
}

export const LAST_ADMIN_MESSAGE = "ต้องมี Admin อย่างน้อย 1 คน กรุณาเพิ่ม Admin คนอื่นก่อน";
