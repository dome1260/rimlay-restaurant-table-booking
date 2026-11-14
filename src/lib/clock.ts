import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { resolveNow, SIM_CLOCK_COOKIE } from "./clock-core";

// The one place server code asks "what time is it". Real time in production.
export async function getNow(): Promise<Date> {
  await connection();
  const store = await cookies();
  return resolveNow(new Date(), store.get(SIM_CLOCK_COOKIE)?.value, process.env.NODE_ENV === "development");
}
