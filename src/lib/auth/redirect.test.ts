import { describe, expect, it } from "vitest";
import { safeRedirect } from "./redirect";

describe("safeRedirect", () => {
  it("keeps back-office paths with their query string", () => {
    expect(safeRedirect("/backoffice")).toBe("/backoffice");
    expect(safeRedirect("/backoffice/bookings?date=2026-11-12")).toBe("/backoffice/bookings?date=2026-11-12");
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["non-string", 42],
    ["absolute URL", "https://evil.example/backoffice"],
    ["protocol-relative", "//evil.example/backoffice"],
    ["backslash trick", "/\\evil.example"],
    ["outside back-office", "/somewhere"],
    ["look-alike prefix", "/backoffice-evil"],
    ["login page loop", "/backoffice/login"],
    ["path traversal out", "/backoffice/../admin"],
  ])("falls back to the home page for %s", (_label, input) => {
    expect(safeRedirect(input)).toBe("/backoffice");
  });
});
