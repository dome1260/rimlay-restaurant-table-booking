import { describe, expect, it } from "vitest";
import { availableSlots, fitsQuota, loadAt, type LoadBooking } from "./quota";

const b = (start_time: string, party_size: number, status: LoadBooking["status"] = "waiting", id?: string): LoadBooking => ({
  id,
  start_time,
  party_size,
  status,
});

describe("loadAt (SYS-01)", () => {
  it("covers start up to but excluding start + 120 minutes (TC-020)", () => {
    const list = [b("18:00", 20)];
    expect(loadAt(list, 18 * 60)).toBe(20);
    expect(loadAt(list, 19 * 60 + 30)).toBe(20);
    expect(loadAt(list, 20 * 60)).toBe(0);
  });

  it("ignores final statuses (TC-103)", () => {
    const list = [b("19:00", 6, "cancelled"), b("19:00", 6, "closed"), b("19:00", 6, "system_closed"), b("19:00", 2, "seated")];
    expect(loadAt(list, 19 * 60)).toBe(2);
  });

  it("can skip a booking by id so edits don't count themselves (TC-038)", () => {
    const list = [b("19:00", 4, "waiting", "me"), b("19:00", 14, "waiting", "other")];
    expect(loadAt(list, 19 * 60, "me")).toBe(14);
  });
});

describe("fitsQuota", () => {
  it("fails when any point of the 120 minute window is over (TC-019, busiest period)", () => {
    const list = [b("19:00", 18)];
    expect(fitsQuota(list, "18:00", 4, 20)).toBe(false);
    expect(fitsQuota(list, "18:00", 2, 20)).toBe(true);
  });

  it("allows the next booking right after the window ends (TC-020)", () => {
    expect(fitsQuota([b("18:00", 20)], "20:00", 4, 20)).toBe(true);
    expect(fitsQuota([b("18:00", 20)], "19:30", 4, 20)).toBe(false);
  });

  it("lets a booking grow in place without double counting (TC-038)", () => {
    const list = [b("19:00", 4, "waiting", "me"), b("19:00", 14, "waiting", "other")];
    expect(fitsQuota(list, "19:00", 6, 20, "me")).toBe(true);
    expect(fitsQuota(list, "19:00", 7, 20, "me")).toBe(false);
  });

  it("has no room when there are no active tables", () => {
    expect(fitsQuota([], "12:00", 1, 0)).toBe(false);
  });
});

describe("availableSlots (TC-010, TC-011)", () => {
  const slots = ["17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30"];

  it("hides slots whose window overlaps a full period (TC-010)", () => {
    const list = [b("19:00", 20)];
    expect(availableSlots(slots, list, 2, 20)).toEqual(["17:00"]);
  });

  it("only shows slots with enough seats left (TC-011)", () => {
    const list = [b("19:00", 16)];
    const six = availableSlots(slots, list, 6, 20);
    const four = availableSlots(slots, list, 4, 20);
    expect(six).not.toContain("19:00");
    expect(four).toContain("19:00");
  });
});
