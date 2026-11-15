import { describe, expect, it } from "vitest";
import { clientKey } from "./client-key";

const h = (values: Record<string, string>) => new Headers(values);

describe("clientKey", () => {
  it("prefers x-real-ip and never exposes the address", () => {
    const key = clientKey(h({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "1.1.1.1, 203.0.113.9" }));
    expect(key).toBe(clientKey(h({ "x-real-ip": "203.0.113.9" })));
    expect(key).not.toContain("203");
    expect(key).toHaveLength(64);
  });
  it("ignores spoofed leading x-forwarded-for hops", () => {
    const a = clientKey(h({ "x-forwarded-for": "1.2.3.4, 198.51.100.7" }));
    const b = clientKey(h({ "x-forwarded-for": "5.6.7.8, 198.51.100.7" }));
    expect(a).toBe(b);
  });
  it("separates different clients", () => {
    expect(clientKey(h({ "x-real-ip": "203.0.113.9" }))).not.toBe(clientKey(h({ "x-real-ip": "203.0.113.10" })));
  });
  it("returns null instead of a shared key when no address is known", () => {
    expect(clientKey(h({}))).toBeNull();
    expect(clientKey(h({ "x-forwarded-for": " " }))).toBeNull();
  });
});
