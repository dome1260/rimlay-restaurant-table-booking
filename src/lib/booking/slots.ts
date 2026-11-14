import { EDD_MINUTES, SLOT_MINUTES, formatMinutes, toMinutes } from "@/lib/store/quota";
import type { BookingChannel } from "./status";

// 'cutoff': web / phone-in close 15 min before the slot (System Rule 6).
// 'walkin': no cutoff, but the slot must be the current one or later.
// 'edit': Staff edits skip the cutoff, but can't move a booking to a slot whose no-show time
// (start + 15 min) has passed, or the scheduled job would close it straight away.
export type TimeRule = "cutoff" | "walkin" | "edit";

export const CUTOFF_MINUTES = 15;
// SYS-03: a "waiting" booking is closed by the system this long after its start.
export const NO_SHOW_MINUTES = 15;

export function timeRuleFor(channel: BookingChannel): TimeRule {
  return channel === "walk_in" ? "walkin" : "cutoff";
}

// SYS-02: every 30 min from opening; the last slot leaves room for EDD before closing.
export function generateSlots(open: string, close: string): string[] {
  const first = toMinutes(open);
  const last = toMinutes(close) - EDD_MINUTES;
  const out: string[] = [];
  for (let m = first; m <= last; m += SLOT_MINUTES) out.push(formatMinutes(m));
  return out;
}

export type BangkokNow = { date: string; minutes: number };

export function bangkokNow(now: Date): BangkokNow {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

// Minutes since an arbitrary epoch, so a date + time can be compared with "now" across midnight.
function absoluteMinutes(date: string, minutes: number): number {
  return Date.parse(`${date}T00:00:00Z`) / 60000 + minutes;
}

export function isSlotBookable(date: string, slot: string, now: Date, rule: TimeRule): boolean {
  const current = bangkokNow(now);
  const nowAbs = absoluteMinutes(current.date, current.minutes);
  const slotAbs = absoluteMinutes(date, toMinutes(slot));
  if (rule === "cutoff") return slotAbs - CUTOFF_MINUTES >= nowAbs;
  if (rule === "edit") return slotAbs + NO_SHOW_MINUTES > nowAbs;
  return slotAbs + SLOT_MINUTES > nowAbs;
}

// Default walk-in time: the slot that is running right now (12:10 -> 12:00).
export function currentSlot(now: Date): string {
  const { minutes } = bangkokNow(now);
  return formatMinutes(Math.floor(minutes / SLOT_MINUTES) * SLOT_MINUTES);
}

// How many minutes past the appointment a waiting booking is (negative = not yet). With
// createdAt, counted like the no-show job: from the later of the appointment and creation, so a
// walk-in added mid-slot doesn't look late from the start.
export function minutesPastAppointment(date: string, startTime: string, now: Date, createdAt?: string): number {
  const current = bangkokNow(now);
  const nowAbs = absoluteMinutes(current.date, current.minutes);
  let fromAbs = absoluteMinutes(date, toMinutes(startTime));
  if (createdAt) {
    const created = bangkokNow(new Date(createdAt));
    fromAbs = Math.max(fromAbs, absoluteMinutes(created.date, created.minutes));
  }
  return nowAbs - fromAbs;
}
