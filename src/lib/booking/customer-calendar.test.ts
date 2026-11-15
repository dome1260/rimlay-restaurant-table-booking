import { describe, expect, it } from "vitest";
import { buildCustomerCells, dayState, maxBookingDate, type PublicCalendar } from "./customer-calendar";

// 2026-11-15 is a Sunday. The store is closed on Monday (1) and has a holiday on 2026-11-24.
const cal: PublicCalendar = {
  today: "2026-11-15",
  maxDate: "2026-12-15",
  openWeekdays: [0, 2, 3, 4, 5, 6],
  holidays: ["2026-11-24"],
};

describe("dayState", () => {
  it("allows today and exactly one month ahead", () => {
    expect(dayState("2026-11-15", cal)).toBe("open");
    expect(dayState("2026-12-15", cal)).toBe("open");
  });
  it("blocks yesterday and one month + 1 day", () => {
    expect(dayState("2026-11-14", cal)).toBe("past");
    expect(dayState("2026-12-16", cal)).toBe("beyond");
  });
  it("blocks closed weekdays and special holidays", () => {
    expect(dayState("2026-11-16", cal)).toBe("closed");
    expect(dayState("2026-11-24", cal)).toBe("holiday");
  });
});

describe("maxBookingDate", () => {
  it("clamps to the last day of a shorter month", () => {
    expect(maxBookingDate("2026-01-31")).toBe("2026-02-28");
    expect(maxBookingDate("2026-11-15")).toBe("2026-12-15");
  });
});

describe("buildCustomerCells", () => {
  it("fills whole weeks and marks today and out-of-month days", () => {
    const cells = buildCustomerCells("2026-11", cal);
    expect(cells.length % 7).toBe(0);
    expect(cells.find((c) => c.isToday)?.date).toBe("2026-11-15");
    // 1 Nov 2026 is a Sunday, so the grid starts in-month and ends in December.
    expect(cells[0].inMonth).toBe(true);
    expect(cells[cells.length - 1].inMonth).toBe(false);
    expect(cells.find((c) => c.date === "2026-11-29")?.state).toBe("open");
    expect(cells.find((c) => c.date === "2026-11-30")?.state).toBe("closed");
  });
});
