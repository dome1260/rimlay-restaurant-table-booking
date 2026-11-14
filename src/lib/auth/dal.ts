import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BACKOFFICE_HOME, BACKOFFICE_LOGIN } from "./redirect";
import { hasRole, type AppRole } from "./roles";

export type CurrentProfile = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: AppRole;
};

// Verifies the JWT (getClaims) and reads the profile through RLS, so a user can only
// ever see their own row. Cached per request to avoid repeated round-trips.
export const getCurrentProfile = cache(async (): Promise<CurrentProfile> => {
  // supabase-js checks token expiry with Date.now(); Cache Components forbids that
  // during prerender, so mark this as request-time work first.
  await connection();
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect(BACKOFFICE_LOGIN);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, email, role, deleted_at")
    .eq("id", userId)
    .maybeSingle();

  // An auth user without a profile isn't a back-office account, and a soft-deleted one must
  // lose access immediately even though their JWT is still valid; drop the session.
  if (!profile || profile.deleted_at) {
    await supabase.auth.signOut();
    redirect(BACKOFFICE_LOGIN);
  }

  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    email: profile.email,
    role: profile.role,
  };
});

export async function requireRole(required: AppRole): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!hasRole(profile.role, required)) redirect(BACKOFFICE_HOME);
  return profile;
}
