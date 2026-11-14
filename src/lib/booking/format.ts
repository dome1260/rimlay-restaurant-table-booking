// Manual Thai formatting: toLocaleDateString("th-TH") differs between Node and browsers and
// caused hydration mismatches before.
const WEEKDAY_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const MONTH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// A real calendar date in YYYY-MM-DD (rejects 2026-02-31 / 2026-13-01). Dates from the URL go
// through this before addDays & co., which throw on an invalid date.
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function formatThaiDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${WEEKDAY_SHORT[weekdayOf(date)]} ${d} ${MONTH_SHORT[m - 1]} ${y + 543}`;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Same as Postgres `date + interval 'n months'`: a day the target month doesn't have becomes its
// last day (01-31 + 1 month = 02-28), so the UI's "up to 1 month ahead" matches booking_validate.
export function addMonths(date: string, months: number): string {
  const [y, m, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

// Event timestamps for the history list, always in Bangkok time.
export function formatEventTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const hh = String(get("hour")).padStart(2, "0");
  const mm = String(get("minute")).padStart(2, "0");
  return `${get("day")} ${MONTH_SHORT[get("month") - 1]} ${hh}:${mm}`;
}
