import { describe, expect, it } from "vitest";
import { createBookingSchema, editBookingSchema, webBookingSchema } from "./schema";

const valid = {
  channel: "walk_in",
  date: "2026-11-15",
  time: "18:00",
  party: "4",
  name: "คุณบี",
  phone: "081-234-5678",
  email: "",
  note: "",
};

describe("createBookingSchema (STF-02)", () => {
  it("accepts a walk-in without email and normalises the phone (TC-051)", () => {
    const parsed = createBookingSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.phone).toBe("0812345678");
      expect(parsed.data.party).toBe(4);
    }
  });

  it("limits party size to 1-8", () => {
    expect(createBookingSchema.safeParse({ ...valid, party: "0" }).success).toBe(false);
    expect(createBookingSchema.safeParse({ ...valid, party: "9" }).success).toBe(false);
    expect(createBookingSchema.safeParse({ ...valid, party: "8" }).success).toBe(true);
    expect(createBookingSchema.safeParse({ ...valid, party: "1" }).success).toBe(true);
  });

  it("requires name and phone", () => {
    const parsed = createBookingSchema.safeParse({ ...valid, name: " ", phone: "" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const keys = parsed.error.issues.map((i) => i.path[0]);
      expect(keys).toContain("name");
      expect(keys).toContain("phone");
    }
  });

  it("rejects a malformed email but allows an empty one", () => {
    expect(createBookingSchema.safeParse({ ...valid, email: "no-at-sign" }).success).toBe(false);
    expect(createBookingSchema.safeParse({ ...valid, email: "a@b.co" }).success).toBe(true);
  });

  it("rejects the web channel (customers book on their own page)", () => {
    expect(createBookingSchema.safeParse({ ...valid, channel: "web" }).success).toBe(false);
  });
});

describe("editBookingSchema (STF-08)", () => {
  it("ignores phone and channel so they can't be changed (TC-073)", () => {
    const parsed = editBookingSchema.safeParse({ ...valid, phone: "0999999999" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect("phone" in parsed.data).toBe(false);
  });
});

describe("webBookingSchema", () => {
  const base = { date: "2026-11-20", time: "18:00", party: "4", name: "สมชาย", phone: "081-234-5678", email: "a@b.co" };

  it("normalizes the phone number and coerces the party size", () => {
    const parsed = webBookingSchema.parse(base);
    expect(parsed.phone).toBe("0812345678");
    expect(parsed.party).toBe(4);
  });
  it("requires an email in a valid format", () => {
    const empty = webBookingSchema.safeParse({ ...base, email: "" });
    expect(empty.success ? "" : empty.error.issues[0].message).toBe("กรุณากรอกอีเมล");
    expect(webBookingSchema.safeParse({ ...base, email: "no-at-sign" }).success).toBe(false);
  });
  it("rejects landlines, foreign numbers and wrong lengths", () => {
    for (const phone of ["021234567", "+66812345678", "08123456", "08123abc78"]) {
      expect(webBookingSchema.safeParse({ ...base, phone }).success).toBe(false);
    }
  });
  it("rejects party sizes outside 1-8", () => {
    for (const party of ["0", "9"]) expect(webBookingSchema.safeParse({ ...base, party }).success).toBe(false);
  });
  it("requires a name, a date and a time", () => {
    expect(webBookingSchema.safeParse({ ...base, name: " " }).success).toBe(false);
    expect(webBookingSchema.safeParse({ ...base, date: "" }).success).toBe(false);
    expect(webBookingSchema.safeParse({ ...base, time: "" }).success).toBe(false);
  });
});
