import { describe, expect, it } from "vitest";
import { buildMonthCells, formatMonthTitle, gridRange, isValidMonth, shiftMonth, type CalBooking } from "./calendar";

function booking(over: Partial<CalBooking>): CalBooking {
  return {
    id: "x",
    booking_date: "2026-11-15",
    start_time: "18:00:00",
    party_size: 2,
    customer_name: "ทดสอบ",
    channel: "web",
    status: "waiting",
    ...over,
  };
}

const ALL_DAYS = new Set([0, 1, 2, 3, 4, 5, 6]);

describe("month helpers", () => {
  it("validates and shifts months across years", () => {
    expect(isValidMonth("2026-11")).toBe(true);
    expect(isValidMonth("2026-13")).toBe(false);
    expect(isValidMonth("2026-1")).toBe(false);
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("formats the Buddhist-era title", () => {
    expect(formatMonthTitle("2026-11")).toBe("พฤศจิกายน 2569");
  });

  it("grid runs Sunday to Saturday around the month", () => {
    // 1 Nov 2026 is a Sunday, 30 Nov is a Monday.
    expect(gridRange("2026-11")).toEqual({ start: "2026-11-01", end: "2026-12-05" });
  });
});

describe("buildMonthCells", () => {
  it("returns whole weeks and marks days outside the month", () => {
    const cells = buildMonthCells("2026-11", [], ALL_DAYS, new Set(), "2026-11-14");
    expect(cells).toHaveLength(35);
    expect(cells[0].date).toBe("2026-11-01");
    expect(cells.filter((c) => c.inMonth)).toHaveLength(30);
    expect(cells.find((c) => c.isToday)?.date).toBe("2026-11-14");
  });

  it("sorts a day's bookings by time and keeps all of them", () => {
    const cells = buildMonthCells(
      "2026-11",
      [
        booking({ id: "c", start_time: "19:00:00" }),
        booking({ id: "a", start_time: "11:00:00" }),
        booking({ id: "b", start_time: "12:30:00" }),
        booking({ id: "d", start_time: "20:00:00" }),
        booking({ id: "e", start_time: "17:00:00" }),
      ],
      ALL_DAYS,
      new Set(),
      "2026-11-14",
    );
    const cell = cells.find((c) => c.date === "2026-11-15")!;
    expect(cell.items.map((i) => i.id)).toEqual(["a", "b", "e", "c", "d"]);
  });

  it("does not count cancelled bookings in the seat total", () => {
    const cells = buildMonthCells(
      "2026-11",
      [booking({ id: "a", party_size: 4 }), booking({ id: "b", party_size: 6, status: "cancelled" })],
      ALL_DAYS,
      new Set(),
      "2026-11-14",
    );
    expect(cells.find((c) => c.date === "2026-11-15")!.seats).toBe(4);
  });

  it("tags closed weekdays and special holidays", () => {
    const open = new Set([0, 2, 3, 4, 5, 6]); // Monday closed
    const cells = buildMonthCells("2026-11", [], open, new Set(["2026-11-24"]), "2026-11-14");
    expect(cells.find((c) => c.date === "2026-11-16")!.closed).toBe("closed");
    expect(cells.find((c) => c.date === "2026-11-24")!.closed).toBe("holiday");
    expect(cells.find((c) => c.date === "2026-11-17")!.closed).toBeNull();
  });
});
