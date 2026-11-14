import { addDays, addMonths, weekdayOf } from "./format";
import type { BookingChannel, BookingStatus } from "./status";

// ADM-04: more than this many bookings in a day shows the "เพิ่มเติม" button.
export const CALENDAR_VISIBLE_ITEMS = 3;

export type CalBooking = {
  id: string;
  booking_date: string;
  start_time: string;
  party_size: number;
  customer_name: string;
  channel: BookingChannel;
  status: BookingStatus;
};

export type CalItem = {
  id: string;
  time: string;
  name: string;
  party: number;
  channel: BookingChannel;
  status: BookingStatus;
};

export type CalCell = {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  closed: "closed" | "holiday" | null;
  items: CalItem[];
  seats: number;
};

const MONTH_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export function isValidMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function shiftMonth(month: string, delta: number): string {
  return addMonths(`${month}-01`, delta).slice(0, 7);
}

export function formatMonthTitle(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_FULL[m - 1]} ${y + 543}`;
}

// The visible grid always starts on Sunday and ends on Saturday, so it spills into
// the neighbouring months.
export function gridRange(month: string): { start: string; end: string } {
  const first = `${month}-01`;
  const last = addDays(addMonths(first, 1), -1);
  return { start: addDays(first, -weekdayOf(first)), end: addDays(last, 6 - weekdayOf(last)) };
}

export function buildMonthCells(
  month: string,
  bookings: CalBooking[],
  openWeekdays: Set<number>,
  holidays: Set<string>,
  today: string,
): CalCell[] {
  const { start, end } = gridRange(month);
  const byDate = new Map<string, CalItem[]>();
  for (const b of bookings) {
    const item: CalItem = {
      id: b.id,
      time: b.start_time.slice(0, 5),
      name: b.customer_name,
      party: b.party_size,
      channel: b.channel,
      status: b.status,
    };
    byDate.set(b.booking_date, [...(byDate.get(b.booking_date) ?? []), item]);
  }

  const cells: CalCell[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    const items = (byDate.get(date) ?? []).sort((a, b) => a.time.localeCompare(b.time));
    cells.push({
      date,
      day: Number(date.slice(8)),
      inMonth: date.startsWith(month),
      isToday: date === today,
      closed: holidays.has(date) ? "holiday" : openWeekdays.has(weekdayOf(date)) ? null : "closed",
      items,
      // Cancelled bookings hold no seats.
      seats: items.filter((i) => i.status !== "cancelled").reduce((sum, i) => sum + i.party, 0),
    });
  }
  return cells;
}
