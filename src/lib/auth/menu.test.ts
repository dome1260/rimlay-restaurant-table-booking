import { describe, expect, it } from "vitest";
import { getMenuForRole } from "./menu";
import { hasRole } from "./roles";

describe("hasRole", () => {
  it("lets admin act as staff but not the other way round", () => {
    expect(hasRole("admin", "staff")).toBe(true);
    expect(hasRole("admin", "admin")).toBe(true);
    expect(hasRole("staff", "staff")).toBe(true);
    expect(hasRole("staff", "admin")).toBe(false);
  });
});

describe("getMenuForRole", () => {
  it("gives staff only the front-desk group (TC-046)", () => {
    const menu = getMenuForRole("staff");
    expect(menu.map((m) => m.key)).toEqual(["home", "bookings", "calendar"]);
    expect(menu.every((m) => m.group === "frontdesk")).toBe(true);
  });

  it("gives admin the staff menu plus the admin group (TC-047)", () => {
    const keys = getMenuForRole("admin").map((m) => m.key);
    expect(keys).toEqual(["home", "bookings", "calendar", "dashboard", "tables", "hours", "users"]);
  });

  it("only exposes pages that exist in Phase 0", () => {
    const available = getMenuForRole("admin").filter((m) => m.available).map((m) => m.key);
    expect(available).toEqual(["home"]);
  });
});
