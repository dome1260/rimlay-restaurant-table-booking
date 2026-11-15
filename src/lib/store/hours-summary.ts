import { trimSeconds } from "./quota";

const WEEKDAY = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

export type HoursRow = { weekday: number; is_open: boolean; open_time: string | null; close_time: string | null };

// "เปิด จ.–ศ. 11:00–22:00 · ส.–อา. 10:00–23:00": consecutive weekdays with the same hours are merged.
export function summarizeHours(rows: HoursRow[]): string {
  const open = [...rows]
    .filter((r) => r.is_open && r.open_time && r.close_time)
    .sort((a, b) => a.weekday - b.weekday);
  if (open.length === 0) return "";
  const groups: { from: number; to: number; range: string }[] = [];
  for (const r of open) {
    const range = `${trimSeconds(r.open_time!)}–${trimSeconds(r.close_time!)}`;
    const last = groups[groups.length - 1];
    if (last && last.range === range && last.to === r.weekday - 1) last.to = r.weekday;
    else groups.push({ from: r.weekday, to: r.weekday, range });
  }
  const days = (g: { from: number; to: number }) =>
    g.from === g.to ? WEEKDAY[g.from] : `${WEEKDAY[g.from]}–${WEEKDAY[g.to]}`;
  return "เปิด " + groups.map((g) => `${days(g)} ${g.range}`).join(" · ");
}
