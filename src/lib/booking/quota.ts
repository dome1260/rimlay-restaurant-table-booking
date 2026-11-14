import { EDD_MINUTES, SLOT_MINUTES, toMinutes } from "@/lib/store/quota";
import { ACTIVE_STATUSES, type BookingStatus } from "./status";

export type LoadBooking = { id?: string; start_time: string; party_size: number; status: BookingStatus };

// Seats in use at one 30-minute point: every open booking covers [start, start + EDD).
export function loadAt(bookings: LoadBooking[], pointMinutes: number, excludeId?: string): number {
  return bookings.reduce((sum, b) => {
    if (!ACTIVE_STATUSES.includes(b.status) || (excludeId && b.id === excludeId)) return sum;
    const start = toMinutes(b.start_time);
    return start <= pointMinutes && pointMinutes < start + EDD_MINUTES ? sum + b.party_size : sum;
  }, 0);
}

// SYS-01: a booking must fit at every 30-minute point of its own EDD window, i.e. the busiest one.
export function fitsQuota(
  bookings: LoadBooking[],
  slot: string,
  party: number,
  maxQuota: number,
  excludeId?: string,
): boolean {
  const start = toMinutes(slot);
  for (let m = start; m < start + EDD_MINUTES; m += SLOT_MINUTES) {
    if (loadAt(bookings, m, excludeId) + party > maxQuota) return false;
  }
  return true;
}

export function availableSlots(
  slots: string[],
  bookings: LoadBooking[],
  party: number,
  maxQuota: number,
  excludeId?: string,
): string[] {
  return slots.filter((slot) => fitsQuota(bookings, slot, party, maxQuota, excludeId));
}
