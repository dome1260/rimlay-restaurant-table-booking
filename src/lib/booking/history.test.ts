import { describe, expect, it } from "vitest";
import { describeChanges, eventActor, eventTitle, type BookingEvent } from "./history";

const base: BookingEvent = {
  id: 1,
  kind: "status",
  from_status: "waiting",
  to_status: "arrived",
  details: null,
  actor_name: "ณัฐ",
  actor_kind: "staff",
  created_at: "2026-11-14T05:00:00Z",
};

describe("history (ADM-05, TC-057, TC-089)", () => {
  it("titles status changes with the Thai label and assigned tables", () => {
    expect(eventTitle(base)).toBe("ลูกค้ามาถึงแล้ว");
    expect(eventTitle({ ...base, to_status: "seated", details: { tables: "T1, T2" } })).toBe("จัดโต๊ะแล้ว · T1, T2");
    expect(eventTitle({ ...base, kind: "created", to_status: "waiting" })).toContain("จองสำเร็จ");
  });

  it("lists what an edit changed", () => {
    const lines = describeChanges({
      party_size: { from: 4, to: 6 },
      start_time: { from: "18:00", to: "19:00" },
      email: { from: null, to: "a@b.co" },
    });
    expect(lines).toEqual(["ที่นั่ง: 4 ท่าน → 6 ท่าน", "เวลา: 18:00 → 19:00", "อีเมล: ไม่มี → a@b.co"]);
  });

  it("says who acted", () => {
    expect(eventActor(base, "walk_in")).toBe("โดย ณัฐ");
    expect(eventActor({ ...base, actor_kind: "customer", actor_name: null }, "web")).toBe("โดยลูกค้า (Web app)");
    expect(eventActor({ ...base, actor_kind: "system", actor_name: null }, "web")).toBe("โดยระบบ");
  });
});
