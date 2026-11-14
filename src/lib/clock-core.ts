export const SIM_CLOCK_COOKIE = "rimlay-sim-offset-ms";

// Simulated time is only a development aid for the cases that otherwise need real waiting
// (cutoffs, no-show). Production must never honour the cookie, so the flag is passed in.
export function resolveNow(real: Date, cookieValue: string | undefined, isDevelopment: boolean): Date {
  if (!isDevelopment || !cookieValue) return real;
  const offset = Number(cookieValue);
  if (!Number.isFinite(offset)) return real;
  return new Date(real.getTime() + offset);
}

// "2026-11-14T17:44" typed as Bangkok local time -> offset to add to the real clock.
export function offsetForBangkokLocal(local: string, real: Date): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  const target = Date.UTC(y, mo - 1, d, h - 7, mi);
  return Number.isNaN(target) ? null : target - real.getTime();
}
