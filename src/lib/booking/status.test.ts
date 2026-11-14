import { describe, expect, it } from "vitest";
import { allowedActions, isFinal, nextAction, type BookingStatus } from "./status";

describe("allowedActions (ADM-05, TC-058, 062, 067, 070, 074)", () => {
  it("offers arrive but not assign while waiting", () => {
    const actions = allowedActions("waiting");
    expect(actions).toContain("arrive");
    expect(actions).not.toContain("assign");
    expect(actions).toContain("cancel");
    expect(actions).toContain("edit");
  });

  it("only lets a waiting booking be edited or cancelled", () => {
    expect(allowedActions("waiting")).toEqual(["arrive", "edit", "cancel"]);
    for (const status of ["arrived", "seated"] as const) {
      expect(allowedActions(status)).not.toContain("edit");
      expect(allowedActions(status)).not.toContain("cancel");
    }
  });

  it("offers assign once arrived", () => {
    expect(allowedActions("arrived")).toEqual(["assign"]);
  });

  it("offers close once seated", () => {
    expect(allowedActions("seated")).toEqual(["close"]);
  });

  it.each<BookingStatus>(["closed", "system_closed", "cancelled"])("is read-only when %s", (status) => {
    expect(allowedActions(status)).toEqual([]);
    expect(isFinal(status)).toBe(true);
    expect(nextAction(status)).toBeNull();
  });

  it("walks the normal flow with one next action per status", () => {
    expect(nextAction("waiting")).toBe("arrive");
    expect(nextAction("arrived")).toBe("assign");
    expect(nextAction("seated")).toBe("close");
  });
});
