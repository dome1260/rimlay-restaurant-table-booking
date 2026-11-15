import { describe, expect, it } from "vitest";
import { canCustomerModify } from "./rules";

// 2026-11-20 17:44 Bangkok = 10:44 UTC
const at = (hhmm: string, ss = "00") => new Date(`2026-11-20T${hhmm}:${ss}+07:00`);

describe("canCustomerModify", () => {
  it("allows a waiting booking until 15 minutes before the appointment", () => {
    expect(canCustomerModify("2026-11-20", "18:00", "waiting", at("17:44"))).toBe(true);
    expect(canCustomerModify("2026-11-20", "18:00", "waiting", at("17:45"))).toBe(true);
  });

  it("closes the moment the cutoff passes, not at the next minute", () => {
    expect(canCustomerModify("2026-11-20", "18:00", "waiting", at("17:45", "01"))).toBe(false);
    expect(canCustomerModify("2026-11-20", "18:00", "waiting", at("17:45", "30"))).toBe(false);
  });

  it("closes at the cutoff", () => {
    expect(canCustomerModify("2026-11-20", "18:00", "waiting", at("17:46"))).toBe(false);
    expect(canCustomerModify("2026-11-20", "18:00", "waiting", at("18:20"))).toBe(false);
  });

  it("works across days", () => {
    expect(canCustomerModify("2026-11-21", "11:00", "waiting", at("17:46"))).toBe(true);
  });

  it("never allows a booking past waiting", () => {
    for (const status of ["arrived", "seated", "closed", "system_closed", "cancelled"] as const) {
      expect(canCustomerModify("2026-11-25", "18:00", status, at("10:00"))).toBe(false);
    }
  });
});
