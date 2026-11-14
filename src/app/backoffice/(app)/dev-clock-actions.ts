"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { offsetForBangkokLocal, SIM_CLOCK_COOKIE } from "@/lib/clock-core";

// Development only: lets cases that need real waiting (cutoff, no-show) be tested by moving
// the app's clock. Refuses outside development so it can't exist in production.
export async function setSimulatedTime(local: string): Promise<{ error?: string }> {
  await requireRole("staff");
  if (process.env.NODE_ENV !== "development") return { error: "ใช้ได้เฉพาะโหมดพัฒนา" };
  const offset = offsetForBangkokLocal(local, new Date());
  if (offset === null) return { error: "รูปแบบวันเวลาไม่ถูกต้อง" };
  (await cookies()).set(SIM_CLOCK_COOKIE, String(offset), { path: "/", sameSite: "lax", httpOnly: true });
  revalidatePath("/backoffice", "layout");
  return {};
}

export async function resetSimulatedTime(): Promise<{ error?: string }> {
  await requireRole("staff");
  if (process.env.NODE_ENV !== "development") return { error: "ใช้ได้เฉพาะโหมดพัฒนา" };
  (await cookies()).delete(SIM_CLOCK_COOKIE);
  revalidatePath("/backoffice", "layout");
  return {};
}
