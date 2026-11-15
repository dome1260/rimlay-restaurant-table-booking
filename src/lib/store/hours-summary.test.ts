import { describe, expect, it } from "vitest";
import { summarizeHours } from "./hours-summary";

const row = (weekday: number, open = "11:00:00", close = "22:00:00", is_open = true) => ({
  weekday,
  is_open,
  open_time: open,
  close_time: close,
});

describe("summarizeHours", () => {
  it("merges consecutive days with the same hours", () => {
    expect(summarizeHours([0, 1, 2, 3, 4, 5, 6].map((d) => row(d)))).toBe("เปิด อา.–ส. 11:00–22:00");
  });
  it("splits groups and skips closed days", () => {
    const rows = [row(0, "10:00:00", "20:00:00"), row(1, "11:00:00", "22:00:00", false), row(2), row(3)];
    expect(summarizeHours(rows)).toBe("เปิด อา. 10:00–20:00 · อ.–พ. 11:00–22:00");
  });
  it("is empty when the store never opens", () => {
    expect(summarizeHours([row(0, "11:00:00", "22:00:00", false)])).toBe("");
  });
});
