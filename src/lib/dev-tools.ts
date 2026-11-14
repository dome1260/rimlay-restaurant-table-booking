import "server-only";

// The simulated clock and the "run jobs" button write real rows with a fake "now", so they must
// never run against the production database, even from a local `npm run dev`.
// TODO(Phase 6): dev and production still share one Supabase project. Before go-live, give
// production its own project and set PRODUCTION_SUPABASE_URL (in every environment) to its URL;
// until then this guard only checks NODE_ENV.
export function devToolsAllowed(): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  const production = process.env.PRODUCTION_SUPABASE_URL;
  return !production || production !== process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export const DEV_TOOLS_REFUSED = "ใช้ได้เฉพาะโหมดพัฒนาที่ไม่ได้ต่อฐานข้อมูล production";
