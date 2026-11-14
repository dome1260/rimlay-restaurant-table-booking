import { describe, expect, it } from "vitest";
import { bangkokToday, businessHoursSchema, holidaySchema, isPastDate, tableSchema } from "./schema";

const day = (weekday: number, over: Partial<{ isOpen: boolean; open: string; close: string }> = {}) => ({
  weekday,
  isOpen: true,
  open: "11:00",
  close: "22:00",
  ...over,
});
const week = (over: Record<number, Parameters<typeof day>[1]> = {}) =>
  [0, 1, 2, 3, 4, 5, 6].map((d) => day(d, over[d]));

describe("tableSchema", () => {
  it("accepts a valid table and trims the name", () => {
    expect(tableSchema.parse({ name: " T1 ", seats: "4" })).toEqual({ name: "T1", seats: 4 });
  });
  it("rejects empty name and out-of-range seats", () => {
    expect(tableSchema.safeParse({ name: "", seats: 4 }).success).toBe(false);
    expect(tableSchema.safeParse({ name: "T1", seats: 0 }).success).toBe(false);
    expect(tableSchema.safeParse({ name: "T1", seats: 21 }).success).toBe(false);
    expect(tableSchema.safeParse({ name: "T1", seats: 2.5 }).success).toBe(false);
    expect(tableSchema.safeParse({ name: "T1", seats: "" }).success).toBe(false);
  });
});

describe("businessHoursSchema", () => {
  it("accepts a normal week", () => {
    expect(businessHoursSchema.safeParse(week()).success).toBe(true);
  });
  it("accepts a closed day without times", () => {
    expect(businessHoursSchema.safeParse(week({ 2: { isOpen: false, open: "", close: "" } })).success).toBe(true);
  });
  it("allows exactly 120 minutes but not 119 or 90", () => {
    expect(businessHoursSchema.safeParse(week({ 1: { open: "11:00", close: "13:00" } })).success).toBe(true);
    expect(businessHoursSchema.safeParse(week({ 1: { open: "11:00", close: "12:30" } })).success).toBe(false);
  });
  it("rejects times off the 30-minute grid", () => {
    expect(businessHoursSchema.safeParse(week({ 1: { open: "11:15" } })).success).toBe(false);
    expect(businessHoursSchema.safeParse(week({ 1: { close: "22:10" } })).success).toBe(false);
  });
  it("rejects close before open and missing times on an open day", () => {
    expect(businessHoursSchema.safeParse(week({ 1: { open: "22:00", close: "11:00" } })).success).toBe(false);
    expect(businessHoursSchema.safeParse(week({ 1: { open: "", close: "" } })).success).toBe(false);
  });
  it("needs 7 distinct weekdays", () => {
    expect(businessHoursSchema.safeParse(week().slice(0, 6)).success).toBe(false);
    expect(businessHoursSchema.safeParse([...week().slice(0, 6), day(0)]).success).toBe(false);
  });
});

describe("holidays", () => {
  it("validates date format and optional note", () => {
    expect(holidaySchema.safeParse({ date: "2026-12-31" }).success).toBe(true);
    expect(holidaySchema.safeParse({ date: "31/12/2026" }).success).toBe(false);
    expect(holidaySchema.safeParse({ date: "2026-02-31x" }).success).toBe(false);
    expect(holidaySchema.safeParse({ date: "2026-12-31", note: "x".repeat(101) }).success).toBe(false);
  });
  it("uses Bangkok time for today", () => {
    // 2026-11-14 18:30 UTC is already 15 Nov in Bangkok.
    const now = new Date("2026-11-14T18:30:00Z");
    expect(bangkokToday(now)).toBe("2026-11-15");
    expect(isPastDate("2026-11-14", now)).toBe(true);
    expect(isPastDate("2026-11-15", now)).toBe(false);
  });
});
