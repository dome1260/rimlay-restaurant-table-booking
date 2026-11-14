import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/backoffice/ui";
import { requireRole } from "@/lib/auth/dal";
import {
  buildBars,
  channelRanking,
  hasNext,
  percentChange,
  periodFor,
  shiftAnchor,
  summarize,
  type DashBooking,
  type DashView,
} from "@/lib/booking/dashboard";
import { bangkokNow } from "@/lib/booking/slots";
import { CHANNEL_LABEL } from "@/lib/booking/status";
import { getNow } from "@/lib/clock";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

type Search = Promise<Record<string, string | string[] | undefined>>;

export default function DashboardPage(props: PageProps<"/backoffice/dashboard">) {
  return (
    <Suspense fallback={<p className="text-rimlay-driftwood">กำลังโหลด Dashboard…</p>}>
      <DashboardContent searchParams={props.searchParams as Search} />
    </Suspense>
  );
}

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

const PAGE_SIZE = 1000;

// PostgREST returns at most 1000 rows per request, and a year of bookings can exceed that.
async function loadBookings(from: string, to: string): Promise<DashBooking[]> {
  const supabase = await createClient();
  const rows: DashBooking[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data } = await supabase
      .from("bookings")
      .select("booking_date, channel, status")
      .gte("booking_date", from)
      .lte("booking_date", to)
      .order("booking_date")
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);
    rows.push(...((data ?? []) as DashBooking[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function DashboardContent({ searchParams }: { searchParams: Search }) {
  await requireRole("admin");
  const params = await searchParams;
  const today = bangkokNow(await getNow()).date;

  const view: DashView = one(params.view) === "year" ? "year" : "week";
  const rawAt = one(params.at);
  const at = /^\d{4}-\d{2}-\d{2}$/.test(rawAt) && rawAt <= today ? rawAt : today;
  const period = periodFor(view, at);

  const supabase = await createClient();
  const [all, { data: hours }, { data: holidays }] = await Promise.all([
    loadBookings(period.prevStart, period.end),
    supabase.from("business_hours").select("weekday, is_open"),
    supabase.from("special_holidays").select("holiday_date").gte("holiday_date", period.start).lte("holiday_date", period.end),
  ]);

  const current = all.filter((b) => b.booking_date >= period.start);
  const previous = all.filter((b) => b.booking_date < period.start);
  const stats = summarize(current);
  const change = percentChange(stats.total, previous.length);
  const bars = buildBars(
    period,
    current,
    new Set((hours ?? []).filter((h) => !h.is_open).map((h) => h.weekday)),
    new Set((holidays ?? []).map((h) => h.holiday_date)),
  );
  const ranking = channelRanking(current);

  const href = (nextView: DashView, anchor: string) =>
    `/backoffice/dashboard?view=${nextView}&at=${anchor}`;
  const prevLabel = view === "week" ? "สัปดาห์ก่อน" : "ปีก่อน";
  const max = Math.max(1, ...bars.map((b) => b.value));
  const chartTitle = view === "week" ? "จำนวนการจอง (คิว) รายวัน" : "จำนวนการจอง (คิว) รายเดือน";
  const summary = bars.map((b) => `${b.label} ${b.closed ? "ร้านปิด" : b.value}`).join(", ");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <PageHeader
        title="Dashboard"
        description="ข้อมูลการจองย้อนหลัง นับตามวันนัด"
        action={
          <div role="group" aria-label="มุมมอง" className="flex gap-1 rounded-field bg-rimlay-shallow p-1">
            {(["week", "year"] as const).map((v) => (
              <Link
                key={v}
                href={href(v, at)}
                aria-current={view === v ? "true" : undefined}
                className={`flex h-9 items-center rounded-lg px-4 text-sm ${
                  view === v ? "bg-white font-semibold text-rimlay-deep shadow-soft" : "font-medium text-rimlay-driftwood"
                }`}
              >
                {v === "week" ? "รายสัปดาห์" : "รายปี"}
              </Link>
            ))}
          </div>
        }
      />

      <div className="flex items-center gap-2">
        <Link
          href={href(view, shiftAnchor(view, at, -1))}
          aria-label="ช่วงก่อนหน้า"
          className="flex size-11 items-center justify-center rounded-field border border-rimlay-border bg-white text-rimlay-deep"
        >
          ‹
        </Link>
        <span className="min-w-40 text-center font-semibold" data-testid="period-label">
          {period.label}
        </span>
        {hasNext(period, today) ? (
          <Link
            href={href(view, shiftAnchor(view, at, 1))}
            aria-label="ช่วงถัดไป"
            className="flex size-11 items-center justify-center rounded-field border border-rimlay-border bg-white text-rimlay-deep"
          >
            ›
          </Link>
        ) : (
          <span
            aria-label="ช่วงถัดไป"
            aria-disabled="true"
            className="flex size-11 items-center justify-center rounded-field border border-rimlay-border bg-white text-rimlay-driftwood/40"
          >
            ›
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-card bg-white p-5 shadow-soft" aria-labelledby="stat-total">
          <h2 id="stat-total" className="text-sm font-semibold text-rimlay-driftwood">การจองทั้งหมด</h2>
          <div className="mt-1 text-4xl font-bold tabular-nums" data-testid="stat-total">
            {stats.total.toLocaleString("en-US")} <span className="text-base font-medium text-rimlay-driftwood">คิว</span>
          </div>
          <div className="mt-1 text-[13px] text-rimlay-driftwood">
            {change === null ? (
              `ไม่มีข้อมูลของ${prevLabel}`
            ) : (
              <span className={change >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
                {change > 0 ? "+" : ""}
                {change}% จาก{prevLabel}
              </span>
            )}
          </div>
        </section>
        <section className="rounded-card bg-white p-5 shadow-soft" aria-labelledby="stat-closed">
          <h2 id="stat-closed" className="text-sm font-semibold text-rimlay-driftwood">ปิดโต๊ะ (สถานะสุดท้าย)</h2>
          <div className="mt-1 text-4xl font-bold tabular-nums" data-testid="stat-closed">
            {stats.allClosed.toLocaleString("en-US")} <span className="text-base font-medium text-rimlay-driftwood">คิว</span>
          </div>
          <div className="mt-1 text-[13px] text-rimlay-driftwood">
            ปิดโต๊ะ {stats.closed.toLocaleString("en-US")} · ปิดโต๊ะโดยระบบ {stats.systemClosed.toLocaleString("en-US")}
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <section className="flex min-w-0 flex-[3] flex-col gap-4 rounded-card bg-white p-5 shadow-soft" aria-labelledby="chart-title">
          <h2 id="chart-title" className="text-lg">{chartTitle}</h2>
          <div
            role="img"
            aria-label={`กราฟแท่ง${chartTitle} ${period.label}: ${summary}`}
            className="flex h-64 items-end gap-1 border-b border-rimlay-border px-1 sm:gap-3 sm:px-2"
            data-testid="bar-chart"
          >
            {bars.map((bar) => (
              <div
                key={bar.label}
                title={bar.closed ? `${bar.label} ร้านปิด` : `${bar.label}: ${bar.value} คิว`}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
              >
                <span className="text-[11px] font-semibold tabular-nums text-rimlay-deep sm:text-[13px]">
                  {bar.closed && bar.value === 0 ? "ปิด" : bar.value}
                </span>
                <div
                  className={`w-full max-w-14 rounded-t-md ${bar.closed && bar.value === 0 ? "bg-rimlay-border" : "bg-rimlay-blue"}`}
                  style={{ height: bar.value === 0 ? 4 : `${Math.max(2, Math.round((bar.value / max) * 85))}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-1 px-1 sm:gap-3 sm:px-2" aria-hidden="true">
            {bars.map((bar) => (
              <span key={bar.label} className="min-w-0 flex-1 text-center text-[11px] text-rimlay-driftwood sm:text-[13px]">
                {bar.label}
              </span>
            ))}
          </div>
        </section>

        <section className="flex min-w-0 flex-[2] flex-col gap-4 rounded-card bg-white p-5 shadow-soft" aria-labelledby="rank-title">
          <h2 id="rank-title" className="text-lg">Ranking ช่องทางการจอง</h2>
          <ol className="flex flex-col gap-4" data-testid="ranking">
            {ranking.map((row, index) => (
              <li key={row.channel} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-3">
                  <span className="flex size-7 items-center justify-center rounded-full bg-rimlay-deep text-[13px] font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="flex-1 font-semibold">{CHANNEL_LABEL[row.channel]}</span>
                  <span className="font-bold tabular-nums">{row.count.toLocaleString("en-US")}</span>
                  <span className="w-10 text-right text-[13px] text-rimlay-driftwood">{row.percent}%</span>
                </div>
                <div className="h-2 rounded-full bg-rimlay-shallow">
                  <div className="h-2 rounded-full bg-rimlay-blue" style={{ width: `${row.percent}%` }} />
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
