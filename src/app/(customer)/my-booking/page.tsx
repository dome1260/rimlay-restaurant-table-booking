import { Suspense } from "react";
import type { Metadata } from "next";
import { loadPublicCalendar } from "@/lib/booking/public";
import { getNow } from "@/lib/clock";
import { loadMyBookings } from "@/lib/customer/bookings";
import { getCustomerSession } from "@/lib/customer/session";
import { FindBooking } from "./find-booking";
import { MyBookings } from "./my-bookings";

export const metadata: Metadata = { title: "ค้นหาคิวของฉัน" };

export default function MyBookingPage({ searchParams }: PageProps<"/my-booking">) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-lg px-4 py-10 text-rimlay-driftwood">กำลังโหลด…</p>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/my-booking">["searchParams"] }) {
  const session = await getCustomerSession();
  if (!session) {
    const expired = (await searchParams).expired !== undefined;
    return <FindBooking notice={expired ? "หมดเวลาการใช้งาน กรุณาขอรหัส OTP ใหม่" : undefined} />;
  }
  const now = await getNow();
  const [{ upcoming, history }, calendar] = await Promise.all([loadMyBookings(session, now), loadPublicCalendar(now)]);
  return <MyBookings phone={session.phone} upcoming={upcoming} history={history} calendar={calendar} />;
}
