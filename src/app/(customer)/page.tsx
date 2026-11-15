import { Suspense } from "react";
import type { Metadata } from "next";
import { loadPublicCalendar } from "@/lib/booking/public";
import { getNow } from "@/lib/clock";
import { BookingFlow } from "./booking-flow";

export const metadata: Metadata = { title: "จองโต๊ะ" };

export default function CustomerHome() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6 lg:pb-16 lg:pt-10">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl">จองโต๊ะ</h1>
        <p className="mt-1 text-rimlay-driftwood">ไม่ต้องสมัครสมาชิก · จองล่วงหน้าได้สูงสุด 1 เดือน</p>
      </div>
      <Suspense fallback={<p className="text-rimlay-driftwood">กำลังโหลด…</p>}>
        <Flow />
      </Suspense>
    </main>
  );
}

async function Flow() {
  const calendar = await loadPublicCalendar(await getNow());
  return <BookingFlow calendar={calendar} />;
}
