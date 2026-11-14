import { describe, expect, it } from "vitest";
import { bangkokNow, currentSlot, generateSlots, isSlotBookable, minutesPastAppointment, timeRuleFor } from "./slots";

// 2026-11-14 17:44 Bangkok = 10:44 UTC
const at = (hhmm: string, date = "2026-11-14") => new Date(`${date}T${hhmm}:00+07:00`);

describe("generateSlots (SYS-02 / TC-008, TC-104)", () => {
  it("runs every 30 minutes and stops 120 minutes before closing", () => {
    const slots = generateSlots("10:00", "22:00");
    expect(slots[0]).toBe("10:00");
    expect(slots.at(-1)).toBe("20:00");
    expect(slots).not.toContain("20:30");
    expect(slots).toHaveLength(21);
  });

  it("gives 5 slots for a 17:00-21:00 day", () => {
    expect(generateSlots("17:00", "21:00")).toEqual(["17:00", "17:30", "18:00", "18:30", "19:00"]);
  });

  it("gives 11:00-21:00 a last slot of 19:00 (TC-092)", () => {
    expect(generateSlots("11:00", "21:00").at(-1)).toBe("19:00");
  });

  it("accepts postgres HH:MM:SS style input trimmed by callers, and a minimum 2 hour day", () => {
    expect(generateSlots("11:00", "13:00")).toEqual(["11:00"]);
    expect(generateSlots("11:00", "12:30")).toEqual([]);
  });
});

describe("isSlotBookable cutoff (TC-009)", () => {
  it("still allows slot 18:00 at 17:44 and closes it from 17:46", () => {
    expect(isSlotBookable("2026-11-14", "18:00", at("17:44"), "cutoff")).toBe(true);
    expect(isSlotBookable("2026-11-14", "18:00", at("17:45"), "cutoff")).toBe(true);
    expect(isSlotBookable("2026-11-14", "18:00", at("17:46"), "cutoff")).toBe(false);
  });

  it("never blocks future days", () => {
    expect(isSlotBookable("2026-11-15", "11:00", at("23:50"), "cutoff")).toBe(true);
  });
});

describe("walk-in rule (TC-054)", () => {
  it("skips the 15 minute cutoff", () => {
    expect(isSlotBookable("2026-11-14", "18:00", at("17:50"), "walkin")).toBe(true);
    expect(isSlotBookable("2026-11-14", "18:00", at("18:20"), "walkin")).toBe(true);
  });

  it("rejects a slot that is already over", () => {
    expect(isSlotBookable("2026-11-14", "18:00", at("18:30"), "walkin")).toBe(false);
    expect(isSlotBookable("2026-11-14", "17:00", at("17:50"), "walkin")).toBe(false);
  });

  it("applies the cutoff to phone-in but not walk-in", () => {
    expect(timeRuleFor("phone_in")).toBe("cutoff");
    expect(timeRuleFor("web")).toBe("cutoff");
    expect(timeRuleFor("walk_in")).toBe("walkin");
    expect(isSlotBookable("2026-11-14", "18:00", at("17:50"), timeRuleFor("phone_in"))).toBe(false);
  });
});

describe("staff edits (rule edit)", () => {
  it("skips the 15 minute cutoff", () => {
    expect(isSlotBookable("2026-11-14", "18:00", at("17:55"), "edit")).toBe(true);
    expect(isSlotBookable("2026-11-14", "18:00", at("18:14"), "edit")).toBe(true);
  });

  it("refuses a slot whose no-show time has passed (the job would close it at once)", () => {
    expect(isSlotBookable("2026-11-14", "18:00", at("18:15"), "edit")).toBe(false);
    expect(isSlotBookable("2026-11-14", "11:00", at("21:00"), "edit")).toBe(false);
  });
});

describe("currentSlot", () => {
  it("floors to the running 30 minute slot", () => {
    expect(currentSlot(at("12:10"))).toBe("12:00");
    expect(currentSlot(at("12:30"))).toBe("12:30");
    expect(currentSlot(at("12:59"))).toBe("12:30");
  });
});

describe("bangkokNow", () => {
  it("uses Asia/Bangkok, not UTC", () => {
    expect(bangkokNow(new Date("2026-11-14T18:30:00Z"))).toEqual({ date: "2026-11-15", minutes: 90 });
  });
});

describe("minutesPastAppointment", () => {
  it("is positive once the appointment time has passed", () => {
    expect(minutesPastAppointment("2026-11-14", "12:00", at("12:08"))).toBe(8);
    expect(minutesPastAppointment("2026-11-14", "12:00", at("11:50"))).toBe(-10);
  });

  it("counts from creation for a booking made after its slot started (walk-in)", () => {
    const created = at("12:20").toISOString();
    expect(minutesPastAppointment("2026-11-14", "12:00", at("12:25"), created)).toBe(5);
    // Booked in advance: the appointment is the later of the two.
    expect(minutesPastAppointment("2026-11-14", "12:00", at("12:08"), at("09:00").toISOString())).toBe(8);
  });
});
