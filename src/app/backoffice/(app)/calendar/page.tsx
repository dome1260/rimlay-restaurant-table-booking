import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader, secondaryButton } from "@/components/backoffice/ui";
import { requireRole } from "@/lib/auth/dal";
import { addMonths } from "@/lib/booking/format";
import { buildMonthCells, formatMonthTitle, gridRange, isValidMonth, shiftMonth, type CalBooking } from "@/lib/booking/calendar";
import { bangkokNow } from "@/lib/booking/slots";
import { getNow } from "@/lib/clock";
import { createClient } from "@/lib/supabase/server";
import { CreateBookingButton } from "../bookings/booking-controls";
import { CalendarView } from "./calendar-view";

export const metadata: Metadata = { title: "ปฏิทินการจอง" };

type Search = Promise<Record<string, string | string[] | undefined>>;

export default function CalendarPage(props: PageProps<"/backoffice/calendar">) {
  return (
    <Suspense fallback={<p className="text-rimlay-driftwood">กำลังโหลดปฏิทิน…</p>}>
      <CalendarContent searchParams={props.searchParams as Search} />
    </Suspense>
  );
}

async function CalendarContent({ searchParams }: { searchParams: Search }) {
  await requireRole("staff");
  const params = await searchParams;
  const today = bangkokNow(await getNow()).date;
  const raw = Array.isArray(params.month) ? params.month[0] : params.month;
  const month = raw && isValidMonth(raw) ? raw : today.slice(0, 7);
  const { start, end } = gridRange(month);

  const supabase = await createClient();
  const [{ data: bookings }, { data: hours }, { data: holidays }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, booking_date, start_time, party_size, customer_name, channel, status")
      .gte("booking_date", start)
      .lte("booking_date", end),
    supabase.from("business_hours").select("weekday, is_open"),
    supabase.from("special_holidays").select("holiday_date").gte("holiday_date", start).lte("holiday_date", end),
  ]);

  const openWeekdays = new Set((hours ?? []).filter((h) => h.is_open).map((h) => h.weekday));
  const cells = buildMonthCells(
    month,
    (bookings ?? []) as CalBooking[],
    openWeekdays,
    new Set((holidays ?? []).map((h) => h.holiday_date)),
    today,
  );

  const link = (m: string) => `/backoffice/calendar?month=${m}`;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <PageHeader
        title="ปฏิทินการจอง"
        description="ดูคิวรายเดือน · คลิกรายการเพื่อเปิดรายละเอียด"
        action={<CreateBookingButton today={today} maxDate={addMonths(today, 1)} />}
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-field border border-rimlay-border bg-white">
          <Link href={link(shiftMonth(month, -1))} aria-label="เดือนก่อนหน้า" className="flex size-11 items-center justify-center text-rimlay-deep">
            ‹
          </Link>
          <span className="min-w-36 px-2 text-center text-[15px] font-semibold" data-testid="month-title">
            {formatMonthTitle(month)}
          </span>
          <Link href={link(shiftMonth(month, 1))} aria-label="เดือนถัดไป" className="flex size-11 items-center justify-center text-rimlay-deep">
            ›
          </Link>
        </div>
        {month !== today.slice(0, 7) ? (
          <Link href={link(today.slice(0, 7))} className={`${secondaryButton} !h-11 !px-4`}>
            วันนี้
          </Link>
        ) : null}
      </div>
      <CalendarView key={month} cells={cells} today={today} />
    </div>
  );
}
