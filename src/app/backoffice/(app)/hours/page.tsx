import { Suspense } from "react";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { bangkokToday } from "@/lib/store/schema";
import { trimSeconds } from "@/lib/store/quota";
import { HoursForm, type DayState } from "./hours-form";
import { HolidaysCard } from "./holidays-card";

export const metadata: Metadata = { title: "เวลาทำการ / วันหยุด" };

export default function HoursPage() {
  return (
    <Suspense fallback={<p className="text-rimlay-driftwood">กำลังโหลดเวลาทำการ…</p>}>
      <HoursContent />
    </Suspense>
  );
}

async function HoursContent() {
  await requireRole("admin");
  const supabase = await createClient();
  const today = bangkokToday();

  const [{ data: hours }, { data: holidays }] = await Promise.all([
    supabase.from("business_hours").select("weekday, is_open, open_time, close_time"),
    supabase
      .from("special_holidays")
      .select("id, holiday_date, note")
      .gte("holiday_date", today)
      .order("holiday_date"),
  ]);

  // A weekday with no row yet is treated as closed until the Admin saves it.
  const days: DayState[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
    const row = hours?.find((h) => h.weekday === weekday);
    return {
      weekday,
      isOpen: row?.is_open ?? false,
      open: row?.open_time ? trimSeconds(row.open_time) : "11:00",
      close: row?.close_time ? trimSeconds(row.close_time) : "22:00",
    };
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 xl:flex-row xl:items-start">
      <div className="min-w-0 flex-[3]">
        <HoursForm days={days} />
      </div>
      <div className="min-w-0 flex-[2]">
        <HolidaysCard holidays={holidays ?? []} today={today} />
      </div>
    </div>
  );
}
