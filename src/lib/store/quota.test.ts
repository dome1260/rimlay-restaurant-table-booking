import { describe, expect, it } from "vitest";
import { bookingWindow, formatMinutes, lastSlotMinutes, maxQuota, toMinutes, trimSeconds } from "./quota";

const table = (seats: number, is_active = true) => ({ seats, is_active });

describe("maxQuota", () => {
  it("sums seats of active tables only (TC-080/081/082)", () => {
    expect(maxQuota([table(4), table(4), table(4), table(4), table(4)])).toBe(20);
    expect(maxQuota([table(4), table(4), table(4), table(4), table(4), table(4)])).toBe(24);
    expect(maxQuota([table(4), table(4), table(4, false)])).toBe(8);
  });
  it("is 0 with no active tables", () => {
    expect(maxQuota([])).toBe(0);
    expect(maxQuota([table(4, false)])).toBe(0);
  });
});

describe("time helpers", () => {
  it("converts between HH:MM and minutes", () => {
    expect(toMinutes("11:30")).toBe(690);
    expect(formatMinutes(690)).toBe("11:30");
    expect(formatMinutes(0)).toBe("00:00");
  });
  it("trims Postgres seconds", () => {
    expect(trimSeconds("11:00:00")).toBe("11:00");
  });
});

describe("bookingWindow", () => {
  it("last slot is closing time minus 120 minutes (TC-092)", () => {
    expect(lastSlotMinutes("21:00")).toBe(19 * 60);
    expect(bookingWindow("11:00", "21:00")).toBe("slot 11:00 – 19:00");
    expect(bookingWindow("11:00:00", "22:00:00")).toBe("slot 11:00 – 20:00");
  });
});
