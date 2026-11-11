"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { INVALID_CREDENTIALS_MESSAGE, loginSchema } from "@/lib/auth/schema";
import { BACKOFFICE_LOGIN, safeRedirect } from "@/lib/auth/redirect";

export type LoginState = {
  error?: string;
  fieldErrors?: { username?: string; password?: string };
  username?: string;
};

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username") ?? "",
    password: formData.get("password") ?? "",
  });
  const typedUsername = String(formData.get("username") ?? "");

  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return {
      username: typedUsername,
      fieldErrors: { username: fields.username?.[0], password: fields.password?.[0] },
    };
  }

  const { username, password } = parsed.data;

  // Unknown username and wrong password return the same message so the form can't be
  // used to discover which usernames exist.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("username", username)
    .maybeSingle();
  if (!profile) return { username: typedUsername, error: INVALID_CREDENTIALS_MESSAGE };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: profile.email, password });
  if (error) return { username: typedUsername, error: INVALID_CREDENTIALS_MESSAGE };

  redirect(safeRedirect(formData.get("next")));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(BACKOFFICE_LOGIN);
}
