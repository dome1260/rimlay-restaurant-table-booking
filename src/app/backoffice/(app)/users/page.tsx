import { Suspense } from "react";
import type { Metadata } from "next";
import { getCurrentProfile, requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { UsersManager } from "./users-manager";

export const metadata: Metadata = { title: "ผู้ใช้งาน" };

type Search = Promise<Record<string, string | string[] | undefined>>;

export default function UsersPage(props: PageProps<"/backoffice/users">) {
  return (
    <Suspense fallback={<p className="text-rimlay-driftwood">กำลังโหลดรายชื่อผู้ใช้…</p>}>
      <UsersContent searchParams={props.searchParams as Search} />
    </Suspense>
  );
}

async function UsersContent({ searchParams }: { searchParams: Search }) {
  await requireRole("admin");
  const me = await getCurrentProfile();
  const { page } = await searchParams;
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
        page={Array.isArray(page) ? page[0] : page}
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
