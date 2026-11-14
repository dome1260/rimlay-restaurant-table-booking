import { Suspense } from "react";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { maxQuota } from "@/lib/store/quota";
import { TablesManager } from "./tables-manager";

export const metadata: Metadata = { title: "จัดการโต๊ะ" };

type Search = Promise<Record<string, string | string[] | undefined>>;

export default function TablesPage(props: PageProps<"/backoffice/tables">) {
  return (
    <Suspense fallback={<p className="text-rimlay-driftwood">กำลังโหลดข้อมูลโต๊ะ…</p>}>
      <TablesContent searchParams={props.searchParams as Search} />
    </Suspense>
  );
}

async function TablesContent({ searchParams }: { searchParams: Search }) {
  await requireRole("admin");
  const { page } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("dining_tables").select("id, name, seats, is_active");
  const tables = [...(data ?? [])].sort((a, b) => a.name.localeCompare(b.name, "th", { numeric: true }));

  // Every table is sent so the quota / active counts stay totals; the list itself is paged.
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <TablesManager tables={tables} maxQuota={maxQuota(tables)} page={Array.isArray(page) ? page[0] : page} />
    </div>
  );
}
