import { describe, expect, it } from "vitest";
import { createUserSchema, updateUserSchema } from "./schema";

const valid = { username: "Mint.J", displayName: "มิ้นท์", email: " Mint@Example.com ", role: "staff", password: "password123" };

describe("createUserSchema", () => {
  it("normalises username and email", () => {
    const parsed = createUserSchema.parse(valid);
    expect(parsed.username).toBe("mint.j");
    expect(parsed.email).toBe("mint@example.com");
  });
  it("rejects bad usernames", () => {
    for (const username of ["ab", "has space", "ไทย", "a".repeat(31), "UPPER!"]) {
      expect(createUserSchema.safeParse({ ...valid, username }).success).toBe(false);
    }
  });
  it("requires an 8+ character password, a valid email and a known role", () => {
    expect(createUserSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...valid, password: "" }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...valid, role: "owner" }).success).toBe(false);
  });
});

describe("updateUserSchema", () => {
  const base = { displayName: "มิ้นท์", email: "mint@example.com", role: "admin" };
  it("treats an empty password as unchanged", () => {
    expect(updateUserSchema.safeParse({ ...base, password: "" }).success).toBe(true);
    expect(updateUserSchema.safeParse(base).success).toBe(true);
  });
  it("still enforces length when a new password is given", () => {
    expect(updateUserSchema.safeParse({ ...base, password: "short" }).success).toBe(false);
    expect(updateUserSchema.safeParse({ ...base, password: "longenough1" }).success).toBe(true);
  });
});
