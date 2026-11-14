import { EDD_MINUTES, SLOT_MINUTES, lastSlotMinutes, toMinutes } from "@/lib/store/quota";
import { weekdayOf } from "./format";
import { loadAt } from "./quota";
import { ACTIVE_STATUSES, type BookingChannel, type BookingStatus } from "./status";

// ADM-08: bookings that a store-settings change would leave in an invalid state. Only
// not-yet-final bookings from today onwards count; they are never cancelled automatically.
export type OpenBooking = {
  id: string;
  booking_date: string;
  start_time: string;
  party_size: number;
  customer_name: string;
  phone: string;
  channel: BookingChannel;
  status: BookingStatus;
};

export type AffectedBooking = {
  id: string;
  date: string;
  time: string;
  name: string;
  phone: string;
  party: number;
  channel: BookingChannel;
};

export type DayHours = { weekday: number; isOpen: boolean; open: string; close: string };

function relevant(bookings: OpenBooking[], today: string): OpenBooking[] {
  return bookings.filter((b) => b.booking_date >= today && ACTIVE_STATUSES.includes(b.status));
}

function toAffected(b: OpenBooking): AffectedBooking {
  return {
    id: b.id,
    date: b.booking_date,
    time: b.start_time.slice(0, 5),
    name: b.customer_name,
    phone: b.phone,
    party: b.party_size,
    channel: b.channel,
  };
}

function sorted(list: AffectedBooking[]): AffectedBooking[] {
  return [...list].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

export function affectedByHoliday(bookings: OpenBooking[], date: string, today: string): AffectedBooking[] {
  return sorted(relevant(bookings, today).filter((b) => b.booking_date === date).map(toAffected));
}

// Only weekdays whose configuration changed are checked, so an old booking that was already
// outside the previous hours does not show up as caused by this save.
export function affectedByHours(
  bookings: OpenBooking[],
  before: DayHours[],
  after: DayHours[],
  today: string,
): AffectedBooking[] {
  const changed = new Set(
    after
      .filter((next) => {
        const prev = before.find((d) => d.weekday === next.weekday);
        return !prev || prev.isOpen !== next.isOpen || (next.isOpen && (prev.open !== next.open || prev.close !== next.close));
      })
      .map((d) => d.weekday),
  );

  return sorted(
    relevant(bookings, today)
      .filter((b) => {
        const weekday = weekdayOf(b.booking_date);
        if (!changed.has(weekday)) return false;
        const next = after.find((d) => d.weekday === weekday);
        if (!next || !next.isOpen) return true;
        const start = toMinutes(b.start_time);
        return start < toMinutes(next.open) || start > lastSlotMinutes(next.close);
      })
      .map(toAffected),
  );
}

// Seats drop (table deactivated or smaller): a booking is affected when any 30-minute point of
// its window is now busier than the new max quota. All bookings covering that point are listed,
// because the Staff decide whom to move.
export function affectedByQuota(bookings: OpenBooking[], newMaxQuota: number, today: string): AffectedBooking[] {
  const open = relevant(bookings, today);
  const hit = new Set<string>();
  const byDate = new Map<string, OpenBooking[]>();
  for (const b of open) byDate.set(b.booking_date, [...(byDate.get(b.booking_date) ?? []), b]);

  for (const dayBookings of byDate.values()) {
    const loadInput = dayBookings.map((b) => ({ id: b.id, start_time: b.start_time, party_size: b.party_size, status: b.status }));
    const points = new Set<number>();
    for (const b of dayBookings) {
      const start = toMinutes(b.start_time);
      for (let m = start; m < start + EDD_MINUTES; m += SLOT_MINUTES) points.add(m);
    }
    for (const point of points) {
      if (loadAt(loadInput, point) <= newMaxQuota) continue;
      for (const b of dayBookings) {
        const start = toMinutes(b.start_time);
        if (start <= point && point < start + EDD_MINUTES) hit.add(b.id);
      }
    }
  }
  return sorted(open.filter((b) => hit.has(b.id)).map(toAffected));
}

const DAY_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

export function describeHoursChange(before: DayHours[], after: DayHours[]): string {
  const parts: string[] = [];
  for (const next of after) {
    const prev = before.find((d) => d.weekday === next.weekday);
    const day = DAY_SHORT[next.weekday];
    if (prev && prev.isOpen && !next.isOpen) parts.push(`ปิดวัน${day}`);
    else if (next.isOpen && (!prev || !prev.isOpen || prev.open !== next.open || prev.close !== next.close)) {
      parts.push(`${day} ${next.open}–${next.close}`);
    }
  }
  return `เปลี่ยนเวลาทำการ: ${parts.join(", ")}`;
}
