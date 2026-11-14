import { describe, expect, it } from "vitest";
import { getMenuForRole, splitBottomNav } from "./menu";
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

  it("only exposes pages that exist so far (Phase 3)", () => {
    const available = getMenuForRole("admin").filter((m) => m.available).map((m) => m.key);
    expect(available).toEqual(["home", "bookings", "calendar", "dashboard", "tables", "hours", "users"]);
  });

  it("keeps the Admin settings pages out of the staff menu", () => {
    const staffAvailable = getMenuForRole("staff").filter((m) => m.available).map((m) => m.key);
    expect(staffAvailable).toEqual(["home", "bookings", "calendar"]);
  });
});

describe("splitBottomNav", () => {
  it("shows every available item when they fit in the bar (Staff)", () => {
    const { bar, more } = splitBottomNav(getMenuForRole("staff"));
    expect(bar.map((m) => m.key)).toEqual(["home", "bookings", "calendar"]);
    expect(more).toEqual([]);
  });

  it("moves the overflow into the more sheet (Admin)", () => {
    const { bar, more } = splitBottomNav(getMenuForRole("admin"));
    expect(bar.map((m) => m.key)).toEqual(["home", "bookings", "calendar", "dashboard"]);
    expect(more.map((m) => m.key)).toEqual(["tables", "hours", "users"]);
  });

  it("skips pages that are not built yet", () => {
    const items = getMenuForRole("admin").map((m) => (m.key === "users" ? { ...m, available: false } : m));
    const { bar, more } = splitBottomNav(items);
    expect([...bar, ...more].some((m) => m.key === "users")).toBe(false);
  });
});
