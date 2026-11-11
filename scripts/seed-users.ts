// Creates the temporary test back-office accounts (admin01, staff01).
// Usage: npm run seed   (reads .env.local; safe to re-run)
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

type SeedUser = {
  username: string;
  displayName: string;
  email: string;
  role: Database["public"]["Enums"]["app_role"];
};

// TODO(before go-live): these are test accounts with a shared test password; replace
// with real staff accounts and rotate the password once user management (Phase 5) exists.
const users: SeedUser[] = [
  { username: "admin01", displayName: "Admin 01", email: env("SEED_ADMIN_EMAIL"), role: "admin" },
  { username: "staff01", displayName: "Staff 01", email: env("SEED_STAFF_EMAIL"), role: "staff" },
];

async function findUserIdByEmail(email: string): Promise<string | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < 200) return null;
  }
}

async function seed(user: SeedUser, password: string) {
  let id = await findUserIdByEmail(user.email);
  if (id) {
    console.log(`= ${user.username}: auth user already exists`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    id = data.user.id;
    console.log(`+ ${user.username}: auth user created`);
  }

  const { error } = await supabase.from("profiles").upsert(
    { id, username: user.username, display_name: user.displayName, email: user.email, role: user.role },
    { onConflict: "id" },
  );
  if (error) throw error;
  console.log(`  ${user.username}: profile upserted (${user.role})`);
}

async function main() {
  const password = env("SEED_TEST_PASSWORD");
  for (const user of users) await seed(user, password);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
