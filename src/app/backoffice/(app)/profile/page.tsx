import { Suspense } from "react";
import type { Metadata } from "next";
import { getCurrentProfile } from "@/lib/auth/dal";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { countActiveAdmins } from "@/lib/users/admin-ops";
import { PageHeader, RolePill } from "@/components/backoffice/ui";
import { DeleteAccount } from "./delete-account";

export const metadata: Metadata = { title: "โปรไฟล์" };

export default function ProfilePage() {
  return (
    <Suspense fallback={<p className="text-rimlay-driftwood">กำลังโหลดโปรไฟล์…</p>}>
      <ProfileContent />
    </Suspense>
  );
}

async function ProfileContent() {
  const profile = await getCurrentProfile();
  const isAdmin = profile.role === "admin";
  const lastAdmin = isAdmin ? (await countActiveAdmins()) <= 1 : false;

  const rows: [string, string][] = [
    ["ชื่อผู้ใช้", profile.username],
    ["ชื่อที่แสดง", profile.displayName],
    ["อีเมล", profile.email],
    ["สิทธิ์", ROLE_LABEL[profile.role]],
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader title="โปรไฟล์" description="ข้อมูลบัญชีของคุณ" />

      <section aria-labelledby="profile-heading" className="rounded-card bg-white p-6 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h2 id="profile-heading" className="text-lg">ข้อมูลผู้ใช้</h2>
          <RolePill role={profile.role} />
        </div>
        <dl className="mt-4 divide-y divide-rimlay-border">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-wrap justify-between gap-x-6 gap-y-1 py-3">
              <dt className="text-rimlay-driftwood">{label}</dt>
              <dd className="break-all font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {isAdmin ? <DeleteAccount lastAdmin={lastAdmin} /> : null}
    </div>
  );
}
