import { describe, expect, it } from "vitest";
import { affectedByHoliday, affectedByHours, affectedByQuota, type DayHours, type OpenBooking } from "./affected";

const TODAY = "2026-11-14";

function booking(over: Partial<OpenBooking>): OpenBooking {
  return {
    id: "b1",
    booking_date: "2026-11-15",
    start_time: "18:00:00",
    party_size: 4,
    customer_name: "ทดสอบ",
    phone: "0812345678",
    channel: "web",
    status: "waiting",
    ...over,
  };
}

const sundayOpen = (close: string): DayHours => ({ weekday: 0, isOpen: true, open: "11:00", close });

describe("affectedByHoliday", () => {
  it("lists every open booking on the date, sorted by time", () => {
    const list = affectedByHoliday(
      [
        booking({ id: "a", start_time: "19:00:00" }),
        booking({ id: "b", start_time: "12:00:00" }),
        booking({ id: "c", booking_date: "2026-11-16" }),
      ],
      "2026-11-15",
      TODAY,
    );
    expect(list.map((b) => b.id)).toEqual(["b", "a"]);
  });

  it("ignores final-status bookings and past dates", () => {
    const list = affectedByHoliday(
      [
        booking({ id: "a", status: "cancelled" }),
        booking({ id: "b", status: "closed" }),
        booking({ id: "c", status: "system_closed" }),
        booking({ id: "d", booking_date: "2026-11-13" }),
      ],
      "2026-11-13",
      TODAY,
    );
    expect(list).toEqual([]);
  });
});

describe("affectedByHours", () => {
  // 2026-11-15 is a Sunday (weekday 0).
  it("flags bookings after the new last slot (close - 120)", () => {
    const list = affectedByHours(
      [booking({ id: "late", start_time: "19:30:00" }), booking({ id: "edge", start_time: "19:00:00" })],
      [sundayOpen("22:00")],
      [sundayOpen("21:00")],
      TODAY,
    );
    expect(list.map((b) => b.id)).toEqual(["late"]);
  });

  it("flags bookings before the new opening time", () => {
    const list = affectedByHours(
      [booking({ id: "early", start_time: "11:00:00" })],
      [sundayOpen("22:00")],
      [{ weekday: 0, isOpen: true, open: "12:00", close: "22:00" }],
      TODAY,
    );
    expect(list.map((b) => b.id)).toEqual(["early"]);
  });

  it("flags every booking on a weekday that is closed", () => {
    const list = affectedByHours(
      [booking({ id: "a" }), booking({ id: "b", booking_date: "2026-11-16" })],
      [sundayOpen("22:00")],
      [{ weekday: 0, isOpen: false, open: "11:00", close: "22:00" }],
      TODAY,
    );
    expect(list.map((b) => b.id)).toEqual(["a"]);
  });

  it("ignores weekdays whose hours did not change", () => {
    const list = affectedByHours(
      [booking({ id: "a", start_time: "20:30:00" })],
      [sundayOpen("22:00")],
      [sundayOpen("22:00")],
      TODAY,
    );
    expect(list).toEqual([]);
  });
});

describe("affectedByQuota", () => {
  it("flags nothing when the busiest point still fits", () => {
    const list = affectedByQuota([booking({ id: "a", party_size: 8 })], 8, TODAY);
    expect(list).toEqual([]);
  });

  it("flags all bookings covering a point that exceeds the new quota", () => {
    const list = affectedByQuota(
      [
        booking({ id: "a", start_time: "18:00:00", party_size: 4 }),
        booking({ id: "b", start_time: "19:00:00", party_size: 4 }),
        booking({ id: "c", start_time: "20:00:00", party_size: 4 }),
      ],
      6,
      TODAY,
    );
    // 18:00 overlaps 19:00 (8 > 6) and 19:00 overlaps 20:00; 18:00 and 20:00 never overlap.
    expect(list.map((b) => b.id)).toEqual(["a", "b", "c"]);
  });

  it("does not count bookings that only touch at the 120 minute boundary", () => {
    const list = affectedByQuota(
      [booking({ id: "a", start_time: "18:00:00" }), booking({ id: "b", start_time: "20:00:00" })],
      4,
      TODAY,
    );
    expect(list).toEqual([]);
  });

  it("ignores final-status bookings", () => {
    const list = affectedByQuota(
      [booking({ id: "a" }), booking({ id: "b", status: "cancelled" })],
      4,
      TODAY,
    );
    expect(list).toEqual([]);
  });
});
