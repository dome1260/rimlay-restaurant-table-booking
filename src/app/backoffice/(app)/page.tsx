import { Suspense } from "react";
import type { Metadata } from "next";
import { getCurrentProfile } from "@/lib/auth/dal";
import { ROLE_LABEL } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "หน้าหลัก" };

export default function BackofficeHomePage() {
  return (
    <Suspense fallback={<p className="text-rimlay-driftwood">กำลังโหลดข้อมูลผู้ใช้…</p>}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const profile = await getCurrentProfile();

  const rows: [string, string][] = [
    ["ชื่อผู้ใช้", profile.username],
    ["ชื่อที่แสดง", profile.displayName],
    ["อีเมล", profile.email],
    ["สิทธิ์", ROLE_LABEL[profile.role]],
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl sm:text-3xl">สวัสดี {profile.displayName}</h1>
        <p className="mt-1 text-rimlay-driftwood">ยินดีต้อนรับสู่ระบบหลังบ้านของ Rimlay</p>
      </div>

      <section aria-labelledby="profile-heading" className="rounded-card bg-white p-6 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h2 id="profile-heading" className="text-lg">
            ข้อมูลผู้ใช้
          </h2>
          <span
            className={`rounded-full px-3 py-1 text-[13px] font-semibold ${
              profile.role === "admin" ? "bg-rimlay-blue text-white" : "bg-rimlay-shallow text-rimlay-blue"
            }`}
          >
            {ROLE_LABEL[profile.role]}
          </span>
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

      <p className="rounded-card bg-rimlay-shallow px-5 py-4 text-sm text-rimlay-deep">
        เมนูที่เหลือจะเปิดใช้ตามลำดับ Phase: รายการจองและปฏิทิน (Phase 2), Dashboard (Phase 3)
      </p>
    </div>
  );
}
