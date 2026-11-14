// Seeds placeholder store settings so the back-office has data to work with.
// Usage: npm run seed:store   (reads .env.local; only fills tables that are still empty)
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";

config({ path: ".env.local", quiet: true });

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env.local`);
  return value;
}

const supabase = createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});

// TODO(before go-live): placeholder data taken from Test Case TC-080 (5 tables x 4 seats = max
// quota 20) and an assumed 11:00-22:00 opening. Replace with Rimlay's real tables and hours
// through the Admin pages; the brief does not state them.
const TABLES = ["T1", "T2", "T3", "T4", "T5"].map((name) => ({ name, seats: 4 }));
const HOURS = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  is_open: true,
  open_time: "11:00",
  close_time: "22:00",
}));

async function isEmpty(table: "dining_tables" | "business_hours"): Promise<boolean> {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) throw error;
  return (count ?? 0) === 0;
}

async function main() {
  if (await isEmpty("dining_tables")) {
    const { error } = await supabase.from("dining_tables").insert(TABLES);
    if (error) throw error;
    console.log(`+ dining_tables: ${TABLES.length} tables inserted`);
  } else {
    console.log("= dining_tables: already has data, skipped");
  }

  if (await isEmpty("business_hours")) {
    const { error } = await supabase.from("business_hours").insert(HOURS);
    if (error) throw error;
    console.log("+ business_hours: 7 days inserted");
  } else {
    console.log("= business_hours: already has data, skipped");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
