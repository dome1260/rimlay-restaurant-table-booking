import { describe, expect, it } from "vitest";
import { generateOtp, hashOtp, hashToken, maskEmail, newSessionToken } from "./otp";

describe("generateOtp", () => {
  it("is always 6 digits, including leading zeros", () => {
    for (let i = 0; i < 200; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
  });
});

describe("hashOtp", () => {
  const secret = "test-secret";
  it("is bound to the phone number", () => {
    expect(hashOtp("0812345678", "123456", secret)).toBe(hashOtp("0812345678", "123456", secret));
    expect(hashOtp("0812345678", "123456", secret)).not.toBe(hashOtp("0898765432", "123456", secret));
    expect(hashOtp("0812345678", "123456", secret)).not.toBe(hashOtp("0812345678", "123457", secret));
  });
  it("depends on the server secret, so a plain hash of the code doesn't match", () => {
    expect(hashOtp("0812345678", "123456", secret)).not.toBe(hashOtp("0812345678", "123456", "other"));
    expect(hashOtp("0812345678", "123456", secret)).not.toBe(hashToken("0812345678:123456"));
  });
});

describe("session token", () => {
  it("is random and hashed for storage", () => {
    const a = newSessionToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(newSessionToken());
    expect(hashToken(a)).not.toBe(a);
  });
});

describe("maskEmail", () => {
  it("keeps the first two characters and the domain", () => {
    expect(maskEmail("somchai@email.com")).toBe("so•••••@email.com");
  });
  it("handles very short local parts", () => {
    expect(maskEmail("a@x.com")).toBe("a•••••@x.com");
    expect(maskEmail("ab@x.com")).toBe("a•••••@x.com");
  });
  it("never echoes a malformed address", () => {
    expect(maskEmail("nonsense")).toBe("•••••");
  });
});
