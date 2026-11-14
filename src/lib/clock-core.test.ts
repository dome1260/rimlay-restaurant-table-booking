import { describe, expect, it } from "vitest";
import { offsetForBangkokLocal, resolveNow } from "./clock-core";

const real = new Date("2026-11-14T10:00:00Z");

describe("resolveNow", () => {
  it("applies the simulated offset in development", () => {
    expect(resolveNow(real, "3600000", true).toISOString()).toBe("2026-11-14T11:00:00.000Z");
  });

  it("never honours the cookie outside development", () => {
    expect(resolveNow(real, "3600000", false)).toBe(real);
  });

  it("falls back to real time for a missing or broken cookie", () => {
    expect(resolveNow(real, undefined, true)).toBe(real);
    expect(resolveNow(real, "abc", true)).toBe(real);
  });
});

describe("offsetForBangkokLocal", () => {
  it("turns a Bangkok wall-clock time into an offset from real time", () => {
    // 17:44 Bangkok = 10:44 UTC, 44 minutes after the real clock above.
    expect(offsetForBangkokLocal("2026-11-14T17:44", real)).toBe(44 * 60000);
  });

  it("rejects malformed input", () => {
    expect(offsetForBangkokLocal("tomorrow", real)).toBeNull();
  });
});
