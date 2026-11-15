import { addDays, addMonths, weekdayOf } from "./format";
import { gridRange } from "./calendar";

export type DayState = "past" | "beyond" | "closed" | "holiday" | "open";

export type PublicCalendar = {
  today: string;
  maxDate: string;
  // Weekdays (0 = Sunday) the store opens on.
  openWeekdays: number[];
  holidays: string[];
};

export type CustomerCell = { date: string; day: number; inMonth: boolean; state: DayState; isToday: boolean };

export function maxBookingDate(today: string): string {
  return addMonths(today, 1);
}

// CUS-03: today up to one month ahead, only on open weekdays, never on a special holiday.
export function dayState(date: string, cal: PublicCalendar): DayState {
  if (date < cal.today) return "past";
  if (date > cal.maxDate) return "beyond";
  if (cal.holidays.includes(date)) return "holiday";
  if (!cal.openWeekdays.includes(weekdayOf(date))) return "closed";
  return "open";
}

export function buildCustomerCells(month: string, cal: PublicCalendar): CustomerCell[] {
  const { start, end } = gridRange(month);
  const cells: CustomerCell[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    cells.push({ date, day: Number(date.slice(8)), inMonth: date.startsWith(month), state: dayState(date, cal), isToday: date === cal.today });
  }
  return cells;
}
