import { Suspense } from "react";
import type { Metadata } from "next";
import { getCurrentProfile, requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { UsersManager } from "./users-manager";

export const metadata: Metadata = { title: "ผู้ใช้งาน" };

export default function UsersPage() {
  return (
    <Suspense fallback={<p className="text-rimlay-driftwood">กำลังโหลดรายชื่อผู้ใช้…</p>}>
      <UsersContent />
    </Suspense>
  );
}

async function UsersContent() {
  await requireRole("admin");
  const me = await getCurrentProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, email, role, created_at")
    .is("deleted_at", null)
    .order("created_at");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <UsersManager
        meId={me.id}
        users={(data ?? []).map((u) => ({
          id: u.id,
          username: u.username,
          displayName: u.display_name,
          email: u.email,
          role: u.role,
        }))}
      />
    </div>
  );
}
