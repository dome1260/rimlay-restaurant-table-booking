import { describe, expect, it } from "vitest";
import { loginSchema } from "./schema";

describe("loginSchema", () => {
  it("trims and lowercases the username", () => {
    const result = loginSchema.parse({ username: "  Admin01 ", password: "secret" });
    expect(result).toEqual({ username: "admin01", password: "secret" });
  });

  it("keeps the password exactly as typed", () => {
    const result = loginSchema.parse({ username: "admin01", password: " Pass Word " });
    expect(result.password).toBe(" Pass Word ");
  });

  it("rejects an empty or whitespace-only username", () => {
    const result = loginSchema.safeParse({ username: "   ", password: "secret" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.username).toEqual(["กรุณากรอกชื่อผู้ใช้"]);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ username: "admin01", password: "" });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.password).toEqual(["กรุณากรอกรหัสผ่าน"]);
  });
});
