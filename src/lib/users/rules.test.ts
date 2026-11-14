import { describe, expect, it } from "vitest";
import { canChangeRole, canDeleteFromList, canDeleteSelf } from "./rules";

const admin = { id: "a1", role: "admin" as const };
const staff = { id: "s1", role: "staff" as const };

describe("canDeleteFromList", () => {
  it("blocks deleting your own row (TC-078)", () => {
    expect(canDeleteFromList(admin, admin)).toBe(false);
    expect(canDeleteFromList(admin, staff)).toBe(true);
  });
});

describe("canDeleteSelf", () => {
  it("blocks the last active Admin (TC-108)", () => {
    expect(canDeleteSelf(admin, 1)).toBe(false);
    expect(canDeleteSelf(admin, 0)).toBe(false);
  });
  it("allows an Admin when others remain (TC-079)", () => {
    expect(canDeleteSelf(admin, 2)).toBe(true);
  });
});

describe("canChangeRole", () => {
  it("blocks demoting the last Admin", () => {
    expect(canChangeRole(admin, "staff", 1)).toBe(false);
    expect(canChangeRole(admin, "staff", 2)).toBe(true);
  });
  it("always allows promotions and no-op changes", () => {
    expect(canChangeRole(staff, "admin", 1)).toBe(true);
    expect(canChangeRole(admin, "admin", 1)).toBe(true);
  });
});
