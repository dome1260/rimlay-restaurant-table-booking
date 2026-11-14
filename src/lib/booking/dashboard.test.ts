import { describe, expect, it } from "vitest";
import {
  buildBars,
  channelRanking,
  hasNext,
  percentChange,
  periodFor,
  shiftAnchor,
  summarize,
  type DashBooking,
} from "./dashboard";

function b(over: Partial<DashBooking>): DashBooking {
  return { booking_date: "2026-11-03", channel: "web", status: "waiting", ...over };
}

describe("periodFor", () => {
  it("week runs Sunday to Saturday and links the previous week", () => {
    // 4 Nov 2026 is a Wednesday
    const p = periodFor("week", "2026-11-04");
    expect(p.start).toBe("2026-11-01");
    expect(p.end).toBe("2026-11-07");
    expect(p.prevStart).toBe("2026-10-25");
    expect(p.prevEnd).toBe("2026-10-31");
    expect(p.label).toBe("1 – 7 พ.ย. 2569");
  });

  it("week label spans months and years", () => {
    expect(periodFor("week", "2026-11-30").label).toBe("29 พ.ย. – 5 ธ.ค. 2569");
    expect(periodFor("week", "2027-01-01").label).toBe("27 ธ.ค. 2569 – 2 ม.ค. 2570");
  });

  it("year covers the calendar year", () => {
    const p = periodFor("year", "2026-06-15");
    expect([p.start, p.end, p.prevStart, p.prevEnd, p.label]).toEqual([
      "2026-01-01",
      "2026-12-31",
      "2025-01-01",
      "2025-12-31",
      "ปี 2569",
    ]);
  });
});

describe("shiftAnchor / hasNext", () => {
  it("moves by a week or a year", () => {
    expect(shiftAnchor("week", "2026-11-04", -1)).toBe("2026-10-28");
    expect(shiftAnchor("year", "2026-06-15", 1)).toBe("2027-01-01");
  });

  it("stops at the period that holds today", () => {
    const today = "2026-11-15";
    expect(hasNext(periodFor("week", "2026-11-15"), today)).toBe(false);
    expect(hasNext(periodFor("week", "2026-11-08"), today)).toBe(true);
    expect(hasNext(periodFor("year", "2026-11-15"), today)).toBe(false);
    expect(hasNext(periodFor("year", "2025-11-15"), today)).toBe(true);
  });
});

describe("buildBars", () => {
  it("counts per day and marks closed weekdays and holidays", () => {
    const p = periodFor("week", "2026-11-04");
    const bars = buildBars(
      p,
      [b({ booking_date: "2026-11-01" }), b({ booking_date: "2026-11-01" }), b({ booking_date: "2026-11-04" })],
      new Set([1]),
      new Set(["2026-11-06"]),
    );
    expect(bars.map((x) => x.value)).toEqual([2, 0, 0, 1, 0, 0, 0]);
    expect(bars.map((x) => x.closed)).toEqual([false, true, false, false, false, true, false]);
    expect(bars[0].label).toBe("อา.");
  });

  it("counts per month for a year", () => {
    const bars = buildBars(
      periodFor("year", "2026-01-01"),
      [b({ booking_date: "2026-01-10" }), b({ booking_date: "2026-11-02" }), b({ booking_date: "2026-11-30" })],
      new Set(),
      new Set(),
    );
    expect(bars).toHaveLength(12);
    expect(bars[0].value).toBe(1);
    expect(bars[10].value).toBe(2);
  });
});

describe("summarize (TC-101)", () => {
  it("10 bookings: 4 closed, 2 system closed, 2 cancelled, 2 waiting", () => {
    const list = [
      ...Array(4).fill(b({ status: "closed" })),
      ...Array(2).fill(b({ status: "system_closed" })),
      ...Array(2).fill(b({ status: "cancelled" })),
      ...Array(2).fill(b({ status: "waiting" })),
    ];
    expect(summarize(list)).toEqual({ total: 10, closed: 4, systemClosed: 2, allClosed: 6 });
  });
});

describe("channelRanking (TC-100)", () => {
  it("orders web 10 > walk-in 5 > phone-in 3 with percentages", () => {
    const list = [
      ...Array(3).fill(b({ channel: "phone_in" })),
      ...Array(10).fill(b({ channel: "web" })),
      ...Array(5).fill(b({ channel: "walk_in" })),
    ];
    expect(channelRanking(list)).toEqual([
      { channel: "web", count: 10, percent: 56 },
      { channel: "walk_in", count: 5, percent: 28 },
      { channel: "phone_in", count: 3, percent: 17 },
    ]);
  });

  it("handles an empty period", () => {
    expect(channelRanking([]).map((r) => [r.count, r.percent])).toEqual([
      [0, 0],
      [0, 0],
      [0, 0],
    ]);
  });
});

describe("percentChange", () => {
  it("rounds and handles a zero base", () => {
    expect(percentChange(186, 166)).toBe(12);
    expect(percentChange(5, 10)).toBe(-50);
    expect(percentChange(5, 0)).toBeNull();
  });
});
