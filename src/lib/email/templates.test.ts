import { describe, expect, it } from "vitest";
import { renderBookingEmail } from "./templates";

const data = { code: "BK-2611-0001", name: "สมชาย", date: "2026-11-15", time: "18:00", party: 4 };

describe("renderBookingEmail (TC-042, TC-107)", () => {
  it("states date, time and seats for a new booking", () => {
    const { subject, body } = renderBookingEmail("created", data);
    expect(subject).toContain("ยืนยันการจอง");
    expect(body).toContain("อา. 15 พ.ย. 2569");
    expect(body).toContain("18:00 น.");
    expect(body).toContain("4 ท่าน");
  });

  it("uses a distinct subject for edits and cancellations", () => {
    expect(renderBookingEmail("edited", data).subject).not.toBe(renderBookingEmail("created", data).subject);
    expect(renderBookingEmail("cancelled", data).subject).toContain("ยกเลิก");
  });

  it("tells the customer a no-show booking was closed (TC-105)", () => {
    const { subject, body, html } = renderBookingEmail("no_show", data);
    expect(subject).toContain("ไม่มาตามเวลานัด");
    expect(body).toContain("15 นาที");
    expect(body).toContain("18:00 น.");
    expect(html).toContain("BK-2611-0001");
    expect(body).not.toContain("20:00");
  });

  it("never mentions an end time", () => {
    const { body } = renderBookingEmail("created", data);
    expect(body).not.toContain("20:00");
    expect(body).not.toMatch(/สิ้นสุด|ถึงเวลา/);
  });
});
