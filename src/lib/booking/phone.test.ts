import { describe, expect, it } from "vitest";
import { formatPhone, isValidPhone, normalizePhone } from "./phone";

describe("phone (OQ-10, TC-012, TC-014)", () => {
  it("strips dashes and spaces", () => {
    expect(normalizePhone("081-234-5678")).toBe("0812345678");
    expect(normalizePhone(" 081 234 5678 ")).toBe("0812345678");
  });

  it("accepts Thai mobiles starting 06 / 08 / 09", () => {
    for (const p of ["0612345678", "0812345678", "0912345678", "081-234-5678"]) expect(isValidPhone(p)).toBe(true);
  });

  it("rejects landlines, foreign numbers, wrong length and letters", () => {
    for (const p of ["021234567", "0212345678", "+66812345678", "081234567", "08123456789", "08123abc78", "0712345678", ""])
      expect(isValidPhone(p)).toBe(false);
  });

  it("formats for display", () => {
    expect(formatPhone("0812345678")).toBe("081-234-5678");
  });
});
