import { describe, expect, it } from "vitest";
import { addDays, addMonths, formatThaiDate, isValidDate } from "./format";

describe("format", () => {
  it("accepts only real calendar dates", () => {
    expect(isValidDate("2026-11-15")).toBe(true);
    expect(isValidDate("2028-02-29")).toBe(true);
    expect(isValidDate("2027-02-29")).toBe(false);
    expect(isValidDate("2026-02-31")).toBe(false);
    expect(isValidDate("2026-13-01")).toBe(false);
    expect(isValidDate("2026-99-99")).toBe(false);
    expect(isValidDate("2026-1-5")).toBe(false);
    expect(isValidDate("")).toBe(false);
  });

  it("formats Thai dates with Buddhist year", () => {
    expect(formatThaiDate("2026-11-10")).toBe("อ. 10 พ.ย. 2569");
    expect(formatThaiDate("2026-11-15")).toBe("อา. 15 พ.ย. 2569");
  });

  it("moves across month ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-11-01", -1)).toBe("2026-10-31");
    expect(addMonths("2026-11-14", 1)).toBe("2026-12-14");
  });

  it("clamps addMonths to the month's last day like Postgres date + interval", () => {
    expect(addMonths("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-10-31", 1)).toBe("2026-11-30");
    expect(addMonths("2026-12-31", 1)).toBe("2027-01-31");
    expect(addMonths("2027-03-31", -1)).toBe("2027-02-28");
  });
});
