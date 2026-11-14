import { addDays, weekdayOf } from "./format";
import type { BookingChannel, BookingStatus } from "./status";

// ADM-09/10/11. Counts follow the appointment date (booking_date), so the numbers match the
// calendar and the booking list.
export type DashBooking = { booking_date: string; channel: BookingChannel; status: BookingStatus };
export type DashView = "week" | "year";

export type Period = {
  view: DashView;
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
  label: string;
};

const DAY_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const MONTH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function periodFor(view: DashView, anchor: string): Period {
  if (view === "year") {
    const y = Number(anchor.slice(0, 4));
    return {
      view,
      start: `${y}-01-01`,
      end: `${y}-12-31`,
      prevStart: `${y - 1}-01-01`,
      prevEnd: `${y - 1}-12-31`,
      label: `ปี ${y + 543}`,
    };
  }
  const start = addDays(anchor, -weekdayOf(anchor));
  const end = addDays(start, 6);
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const label =
    sm === em
      ? `${sd} – ${ed} ${MONTH_SHORT[em - 1]} ${ey + 543}`
      : `${sd} ${MONTH_SHORT[sm - 1]}${sy === ey ? "" : ` ${sy + 543}`} – ${ed} ${MONTH_SHORT[em - 1]} ${ey + 543}`;
  return { view, start, end, prevStart: addDays(start, -7), prevEnd: addDays(start, -1), label };
}

export function shiftAnchor(view: DashView, anchor: string, delta: number): string {
  if (view === "year") return `${Number(anchor.slice(0, 4)) + delta}-01-01`;
  return addDays(anchor, 7 * delta);
}

// Dashboard is for history: the arrow forward stops at the period that contains today.
export function hasNext(period: Period, today: string): boolean {
  return period.end < today;
}

export type Bar = { label: string; value: number; closed: boolean };

export function buildBars(
  period: Period,
  bookings: DashBooking[],
  closedWeekdays: Set<number>,
  holidays: Set<string>,
): Bar[] {
  if (period.view === "year") {
    const counts = new Array<number>(12).fill(0);
    for (const b of bookings) counts[Number(b.booking_date.slice(5, 7)) - 1] += 1;
    return counts.map((value, i) => ({ label: MONTH_SHORT[i], value, closed: false }));
  }
  const byDate = new Map<string, number>();
  for (const b of bookings) byDate.set(b.booking_date, (byDate.get(b.booking_date) ?? 0) + 1);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(period.start, i);
    const weekday = weekdayOf(date);
    return {
      label: DAY_SHORT[weekday],
      value: byDate.get(date) ?? 0,
      closed: closedWeekdays.has(weekday) || holidays.has(date),
    };
  });
}

// ADM-11: "closed" counts both final-by-Staff and final-by-system statuses.
export function summarize(bookings: DashBooking[]) {
  const closed = bookings.filter((b) => b.status === "closed").length;
  const systemClosed = bookings.filter((b) => b.status === "system_closed").length;
  return { total: bookings.length, closed, systemClosed, allClosed: closed + systemClosed };
}

// Whole-number percent vs the previous period; null when there is nothing to compare with.
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export type RankRow = { channel: BookingChannel; count: number; percent: number };

const CHANNEL_ORDER: BookingChannel[] = ["web", "walk_in", "phone_in"];

export function channelRanking(bookings: DashBooking[]): RankRow[] {
  const total = bookings.length;
  return CHANNEL_ORDER.map((channel, order) => ({
    channel,
    order,
    count: bookings.filter((b) => b.channel === channel).length,
  }))
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .map(({ channel, count }) => ({ channel, count, percent: total === 0 ? 0 : Math.round((count / total) * 100) }));
}
