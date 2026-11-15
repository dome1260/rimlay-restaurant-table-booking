import { createHash } from "node:crypto";

// Picks an IP the client can't choose. x-real-ip is set by the hosting edge (Vercel overwrites it).
// In x-forwarded-for a client can prepend any value, so only the last hop, the one our own proxy
// appended, is used. Returns null when neither exists, so the caller never lumps every customer
// into one shared bucket. Only a hash is stored so the table never holds raw IPs.
// TODO(Phase 6): confirm on the Vercel deployment that x-real-ip carries the visitor's IP.
export function clientKey(headers: { get(name: string): string | null }): string | null {
  const realIp = headers.get("x-real-ip")?.trim();
  const forwarded = headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  const ip = realIp || forwarded;
  return ip ? createHash("sha256").update(ip).digest("hex") : null;
}
