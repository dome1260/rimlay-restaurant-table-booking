import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/dal";
import { addDays, addMonths, formatThaiDate, isValidDate } from "@/lib/booking/format";
import { formatPhone, normalizePhone } from "@/lib/booking/phone";
import { bangkokNow, minutesPastAppointment } from "@/lib/booking/slots";
import { CHANNEL_LABEL, type BookingChannel, type BookingStatus } from "@/lib/booking/status";
import { getNow } from "@/lib/clock";
import { trimSeconds } from "@/lib/store/quota";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, inputClass, secondaryButton } from "@/components/backoffice/ui";
import { Pagination } from "@/components/backoffice/Pagination";
import { paginate } from "@/lib/pagination";
import { CreateBookingButton, NextActionButton } from "./booking-controls";
import { StatusPill } from "./status-pill";

export const metadata: Metadata = { title: "รายการจอง" };

type Search = Promise<Record<string, string | string[] | undefined>>;

export default function BookingsPage(props: PageProps<"/backoffice/bookings">) {
  return (
    <Suspense fallback={<p className="text-rimlay-driftwood">กำลังโหลดรายการจอง…</p>}>
      <BookingsContent searchParams={props.searchParams as Search} />
    </Suspense>
  );
}

const TABS: { key: string; label: string; match: (s: BookingStatus) => boolean }[] = [
  { key: "all", label: "ทั้งหมด", match: () => true },
  { key: "waiting", label: "รอมาถึง", match: (s) => s === "waiting" },
  { key: "arrived", label: "มาถึงแล้ว", match: (s) => s === "arrived" },
  { key: "seated", label: "จัดโต๊ะแล้ว", match: (s) => s === "seated" },
  { key: "closed", label: "ปิดโต๊ะ", match: (s) => s === "closed" || s === "system_closed" },
  { key: "cancelled", label: "ยกเลิก", match: (s) => s === "cancelled" },
];

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

async function BookingsContent({ searchParams }: { searchParams: Search }) {
  await requireRole("staff");
  const params = await searchParams;
  const now = await getNow();
  const today = bangkokNow(now).date;

  const rawDate = one(params.date);
  const date = isValidDate(rawDate) ? rawDate : today;
  const q = one(params.q).trim();
  const channelFilter = one(params.channel);
  // Default: newest created first. The user can cycle to appointment time desc, then asc.
  const rawSort = one(params.sort);
  const sort: SortMode = rawSort === "time-desc" || rawSort === "time-asc" ? rawSort : "created";
  const tab = TABS.find((t) => t.key === one(params.status)) ?? TABS[0];

  const supabase = await createClient();
  const query = supabase
    .from("bookings")
    .select("id, start_time, party_size, customer_name, phone, channel, status, created_at, booking_tables(dining_tables(name))")
    .eq("booking_date", date);
  const { data } = await (sort === "created"
    ? query.order("created_at", { ascending: false })
    : query.order("start_time", { ascending: sort === "time-asc" }).order("created_at", { ascending: false }));

  const digits = normalizePhone(q);
  const filtered = (data ?? []).filter((b) => {
    if (channelFilter && b.channel !== channelFilter) return false;
    if (!q) return true;
    return b.customer_name.toLowerCase().includes(q.toLowerCase()) || (digits.length > 0 && b.phone.includes(digits));
  });
  const paged = paginate(
    filtered.filter((b) => tab.match(b.status)),
    one(params.page),
  );
  const rows = paged.items;

  // Changing the date, filter, tab or sort starts again from page 1 (page is only kept when set).
  const href = (over: Record<string, string>) => {
    const next = new URLSearchParams();
    const merged: Record<string, string> = { date, q, channel: channelFilter, status: tab.key, sort: sort === "created" ? "" : sort, ...over };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "status" && v === "all")) next.set(k, v);
    return `/backoffice/bookings?${next.toString()}`;
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <PageHeader
        title="รายการจอง"
        description="ทุกช่องทาง · Web app, Walk-in, Phone-in"
        action={<CreateBookingButton today={today} maxDate={addMonths(today, 1)} />}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-field border border-rimlay-border bg-white">
          <Link href={href({ date: addDays(date, -1) })} aria-label="วันก่อนหน้า" className="flex size-11 items-center justify-center text-rimlay-deep">
            ‹
          </Link>
          <span className="px-2 text-[15px] font-semibold" data-testid="selected-date">
            {date === today ? "วันนี้ · " : ""}
            {formatThaiDate(date)}
          </span>
          <Link href={href({ date: addDays(date, 1) })} aria-label="วันถัดไป" className="flex size-11 items-center justify-center text-rimlay-deep">
            ›
          </Link>
        </div>
        {date !== today ? (
          <Link href={href({ date: today })} className={`${secondaryButton} !h-11 !px-4`}>
            วันนี้
          </Link>
        ) : null}

        <form method="get" action="/backoffice/bookings" className="flex min-w-64 flex-1 flex-wrap items-center gap-3">
          <input type="hidden" name="date" value={date} />
          {tab.key !== "all" ? <input type="hidden" name="status" value={tab.key} /> : null}
          {sort !== "created" ? <input type="hidden" name="sort" value={sort} /> : null}
          <label htmlFor="q" className="sr-only">ค้นหา</label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="ค้นหาชื่อ หรือเบอร์โทรศัพท์"
            className={`${inputClass} min-w-48 flex-1`}
          />
          <label htmlFor="channel" className="sr-only">ช่องทาง</label>
          <select id="channel" name="channel" defaultValue={channelFilter} className={`${inputClass} !w-auto`}>
            <option value="">ทุกช่องทาง</option>
            {(Object.keys(CHANNEL_LABEL) as BookingChannel[]).map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABEL[c]}
              </option>
            ))}
          </select>
          <button type="submit" className={`${secondaryButton} !h-11`}>
            ค้นหา
          </button>
          <SortToggle href={href({ sort: NEXT_SORT[sort] })} mode={sort} className="xl:hidden" />
        </form>
      </div>

      <div role="tablist" aria-label="กรองตามสถานะ" className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const count = filtered.filter((b) => t.match(b.status)).length;
          const on = t.key === tab.key;
          return (
            <Link
              key={t.key}
              role="tab"
              aria-selected={on}
              href={href({ status: t.key })}
              className={`flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold ${
                on ? "border-rimlay-deep bg-rimlay-deep text-white" : "border-rimlay-border bg-white text-rimlay-deep hover:bg-rimlay-shallow"
              }`}
            >
              {t.label}
              <span className={`flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs ${on ? "bg-white/20" : "bg-rimlay-shallow"}`}>
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-card bg-white p-8 text-center text-rimlay-driftwood shadow-soft">
          ไม่มีคิวในวันที่เลือก{q || channelFilter || tab.key !== "all" ? " ตามเงื่อนไขที่กรอง" : ""}
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-card bg-white shadow-soft xl:block">
            <table className="w-full min-w-[900px] border-collapse text-[15px]">
              <thead>
                <tr className="border-b border-rimlay-border text-left text-[13px] text-rimlay-driftwood">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    <span className="inline-flex items-center gap-1">
                      เวลา
                      <SortToggle href={href({ sort: NEXT_SORT[sort] })} mode={sort} small />
                    </span>
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">ผู้จอง</th>
                  <th scope="col" className="px-4 py-3 font-semibold">ที่นั่ง</th>
                  <th scope="col" className="px-4 py-3 font-semibold">ช่องทาง</th>
                  <th scope="col" className="px-4 py-3 font-semibold">โต๊ะ</th>
                  <th scope="col" className="px-4 py-3 font-semibold">สถานะ</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">การดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const late = b.status === "waiting" ? minutesPastAppointment(date, trimSeconds(b.start_time), now, b.created_at) : 0;
                  return (
                    <tr key={b.id} className="border-b border-rimlay-border/60 last:border-0" data-testid="booking-row">
                      <td className="px-4 py-3.5 align-top font-bold tabular-nums">{trimSeconds(b.start_time)}</td>
                      <td className="px-4 py-3.5 align-top">
                        <Link href={`/backoffice/bookings/${b.id}`} className="font-semibold hover:underline">
                          {b.customer_name}
                        </Link>
                        <div className="text-[13px] text-rimlay-driftwood">{formatPhone(b.phone)}</div>
                        {late > 0 ? <LateBadge minutes={late} /> : null}
                      </td>
                      <td className="px-4 py-3.5 align-top">{b.party_size}</td>
                      <td className="px-4 py-3.5 align-top">
                        <span className="whitespace-nowrap rounded-md border border-rimlay-border px-2 py-0.5 text-[13px]">
                          {CHANNEL_LABEL[b.channel]}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 align-top text-rimlay-driftwood">{tableNames(b.booking_tables)}</td>
                      <td className="px-4 py-3.5 align-top"><StatusPill status={b.status} /></td>
                      <td className="px-4 py-2.5 align-top">
                        <div className="flex items-center justify-end gap-2">
                          <NextActionButton id={b.id} status={b.status} name={b.customer_name} compact />
                          <Link
                            href={`/backoffice/bookings/${b.id}`}
                            aria-label={`ดูรายละเอียด ${b.customer_name}`}
                            className="flex size-10 items-center justify-center rounded-field border border-rimlay-border text-rimlay-deep hover:bg-rimlay-shallow"
                          >
                            ›
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-3 xl:hidden">
            {rows.map((b) => {
              const late = b.status === "waiting" ? minutesPastAppointment(date, trimSeconds(b.start_time), now, b.created_at) : 0;
              return (
                <li key={b.id} className="flex flex-col gap-3 rounded-card bg-white p-4 shadow-soft" data-testid="booking-card">
                  <Link href={`/backoffice/bookings/${b.id}`} className="flex items-start gap-3">
                    <span className="w-12 text-[17px] font-bold tabular-nums">{trimSeconds(b.start_time)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{b.customer_name}</span>
                      <span className="text-[13px] text-rimlay-driftwood">
                        {b.party_size} ท่าน · {CHANNEL_LABEL[b.channel]}
                        {tableNames(b.booking_tables) !== "–" ? ` · ${tableNames(b.booking_tables)}` : ""}
                      </span>
                    </span>
                    <StatusPill status={b.status} />
                  </Link>
                  {late > 0 ? <LateBadge minutes={late} /> : null}
                  <NextActionButton id={b.id} status={b.status} name={b.customer_name} />
                </li>
              );
            })}
          </ul>
        </>
      )}
      <Pagination {...paged} unit="คิว" href={(p) => href({ page: p > 1 ? String(p) : "" })} />
    </div>
  );
}

function LateBadge({ minutes }: { minutes: number }) {
  return (
    <span className="mt-1.5 inline-block rounded-md bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
      เลยเวลานัด {minutes} นาที
    </span>
  );
}

function tableNames(rows: { dining_tables: { name: string } | null }[]): string {
  const names = rows.map((r) => r.dining_tables?.name).filter((n): n is string => Boolean(n));
  return names.length ? names.sort((a, b) => a.localeCompare(b, "th", { numeric: true })).join(" + ") : "–";
}

type SortMode = "created" | "time-desc" | "time-asc";

// Click order: newest created (default) -> time high-to-low -> time low-to-high -> default.
const NEXT_SORT: Record<SortMode, string> = { created: "time-desc", "time-desc": "time-asc", "time-asc": "" };

const SORT_LABEL: Record<SortMode, string> = {
  created: "เรียงตามคิวที่สร้างล่าสุด (กดเพื่อเรียงเวลามากไปน้อย)",
  "time-desc": "เรียงเวลามากไปน้อย (กดเพื่อเรียงน้อยไปมาก)",
  "time-asc": "เรียงเวลาน้อยไปมาก (กดเพื่อกลับไปเรียงตามคิวที่สร้างล่าสุด)",
};

// Icon-only toggle. Plain icon = newest created first (default); dark icon with a down arrow =
// time high to low; dark icon with an up arrow = time low to high.
function SortToggle({ href, mode, small, className = "" }: { href: string; mode: SortMode; small?: boolean; className?: string }) {
  const active = mode !== "created";
  return (
    <Link
      href={href}
      aria-label={SORT_LABEL[mode]}
      title={SORT_LABEL[mode]}
      data-testid="sort-toggle"
      data-sort={mode}
      className={`inline-flex items-center justify-center rounded-field border ${
        active
          ? "border-rimlay-deep bg-rimlay-deep text-white hover:bg-rimlay-deep/90"
          : "border-rimlay-border bg-white text-rimlay-deep hover:bg-rimlay-shallow"
      } ${small ? "size-7" : "size-11"} ${className}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {mode === "time-desc" ? <path d="M12 5v14m-6-6 6 6 6-6" /> : mode === "time-asc" ? <path d="M12 19V5m-6 6 6-6 6 6" /> : <path d="m7 15 5 5 5-5M7 9l5-5 5 5" />}
      </svg>
    </Link>
  );
}
