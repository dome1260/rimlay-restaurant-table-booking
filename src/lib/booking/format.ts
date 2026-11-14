// Manual Thai formatting: toLocaleDateString("th-TH") differs between Node and browsers and
// caused hydration mismatches before.
const WEEKDAY_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const MONTH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

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

export function addMonths(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
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
