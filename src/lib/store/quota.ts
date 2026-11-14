// Estimated dining duration 90 min + 30 min safety (System Rule 3). The last bookable slot
// must leave this much room before closing.
export const EDD_MINUTES = 120;
export const SLOT_MINUTES = 30;

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Postgres returns time as "HH:MM:SS"; the UI works with "HH:MM".
export function trimSeconds(time: string): string {
  return time.slice(0, 5);
}

// System Rule 2: max quota per slot = seats of every active table.
export function maxQuota(tables: { seats: number; is_active: boolean }[]): number {
  return tables.reduce((sum, t) => (t.is_active ? sum + t.seats : sum), 0);
}

export function lastSlotMinutes(close: string): number {
  return toMinutes(close) - EDD_MINUTES;
}

export function bookingWindow(open: string, close: string): string {
  return `slot ${trimSeconds(open)} – ${formatMinutes(lastSlotMinutes(close))}`;
}

// Opening times to offer in the hours form: every 30 minutes, 00:00–23:30.
export const TIME_OPTIONS: string[] = Array.from({ length: 48 }, (_, i) => formatMinutes(i * SLOT_MINUTES));
