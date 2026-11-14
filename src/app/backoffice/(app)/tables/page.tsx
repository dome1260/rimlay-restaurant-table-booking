import { Suspense } from "react";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { maxQuota } from "@/lib/store/quota";
import { TablesManager } from "./tables-manager";

export const metadata: Metadata = { title: "จัดการโต๊ะ" };

export default function TablesPage() {
  return (
    <Suspense fallback={<p className="text-rimlay-driftwood">กำลังโหลดข้อมูลโต๊ะ…</p>}>
      <TablesContent />
    </Suspense>
  );
}

async function TablesContent() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("dining_tables").select("id, name, seats, is_active");
  const tables = [...(data ?? [])].sort((a, b) => a.name.localeCompare(b.name, "th", { numeric: true }));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <TablesManager tables={tables} maxQuota={maxQuota(tables)} />
    </div>
  );
}
