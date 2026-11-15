"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/backoffice/ConfirmDialog";
import { dangerSmallButton, secondaryButton, smallButton } from "@/components/backoffice/ui";
import type { PublicCalendar } from "@/lib/booking/customer-calendar";
import { formatThaiDate } from "@/lib/booking/format";
import { formatPhone } from "@/lib/booking/phone";
import { STATUS_LABEL, STATUS_STYLE } from "@/lib/booking/status";
import type { MyBooking } from "@/lib/customer/bookings";
import { cancelMyBooking, signOutCustomer, type MyEditState } from "./actions";
import { EditBooking } from "./edit-booking";

export function MyBookings({
  phone,
  upcoming,
  history,
  calendar,
}: {
  phone: string;
  upcoming: MyBooking[];
  history: MyBooking[];
  calendar: PublicCalendar;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<MyBooking | null>(null);
  const [notice, setNotice] = useState<string>();
  const [signingOut, startSignOut] = useTransition();
  const editing = upcoming.find((b) => b.id === editingId) ?? null;

  // The session ended while the page was open: back to the phone + OTP step.
  function expire() {
    router.replace("/my-booking?expired=1");
    router.refresh();
  }

  function saved(done: NonNullable<MyEditState["done"]>) {
    setEditingId(null);
    setNotice(
      done.emailChanged
        ? `บันทึกแล้ว ส่งอีเมลแจ้งการเปลี่ยนแปลงไปที่ ${done.email} คิวนี้ผูกกับอีเมลใหม่จึงไม่แสดงในรายการนี้ ขอ OTP ใหม่เพื่อดูคิวจากอีเมลนั้น`
        : `บันทึกการเปลี่ยนแปลงแล้ว ส่งอีเมลแจ้งไปที่ ${done.email}`,
    );
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:pt-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl">คิวของฉัน</h1>
          <p className="mt-1 text-rimlay-driftwood">เบอร์ {formatPhone(phone)}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/" className={secondaryButton}>
            จองคิวใหม่
          </Link>
          <button
            type="button"
            disabled={signingOut}
            onClick={() =>
              startSignOut(async () => {
                await signOutCustomer();
                router.replace("/my-booking");
                router.refresh();
              })
            }
            className={secondaryButton}
          >
            ออก
          </button>
        </div>
      </div>

      {notice ? (
        <div role="status" className="mb-5 rounded-field border border-emerald-200 bg-emerald-50 px-4 py-3 text-[15px] text-emerald-900">
          {notice}
        </div>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-col gap-3 lg:w-[26rem] lg:shrink-0">
          <h2 className="text-sm font-semibold text-rimlay-driftwood">คิวที่กำลังจะถึง</h2>
          {upcoming.length === 0 ? (
            <p className="rounded-card border border-rimlay-border bg-white p-5 text-[15px] text-rimlay-driftwood">ไม่มีคิวที่กำลังจะถึง</p>
          ) : (
            upcoming.map((booking) => (
              <article
                key={booking.id}
                className={`flex flex-col gap-3.5 rounded-card bg-white p-5 shadow-soft ${
                  booking.id === editingId ? "border-2 border-rimlay-blue" : "border border-rimlay-border"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-bold">{formatThaiDate(booking.date)}</div>
                    <div className="mt-0.5 text-[15px] text-rimlay-driftwood">
                      {booking.time} น. · {booking.party} ท่าน
                    </div>
                  </div>
                  <StatusPill status={booking.status} />
                </div>
                <div className="break-all text-sm text-rimlay-driftwood">
                  {booking.name} · {booking.email}
                </div>
                {booking.status === "waiting" ? (
                  <>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!booking.canModify}
                        onClick={() => {
                          setNotice(undefined);
                          setEditingId(booking.id);
                        }}
                        className={`${smallButton} h-11 flex-1`}
                      >
                        {booking.id === editingId ? "กำลังแก้ไข" : "แก้ไข"}
                      </button>
                      <button
                        type="button"
                        disabled={!booking.canModify}
                        onClick={() => setCancelTarget(booking)}
                        className={`${dangerSmallButton} h-11 flex-1`}
                      >
                        ยกเลิกคิว
                      </button>
                    </div>
                    {!booking.canModify ? (
                      <p className="text-[13px] text-rimlay-driftwood">
                        เหลือน้อยกว่า 15 นาทีก่อนเวลานัด แก้ไข/ยกเลิกไม่ได้แล้ว กรุณาติดต่อร้าน
                      </p>
                    ) : null}
                  </>
                ) : null}
              </article>
            ))
          )}

          {history.length > 0 ? (
            <>
              <h2 className="mt-3 text-sm font-semibold text-rimlay-driftwood">ประวัติ 30 วันล่าสุด</h2>
              {history.map((booking) => (
                <article key={booking.id} className="flex items-center justify-between gap-3 rounded-card border border-rimlay-border bg-white px-5 py-3.5">
                  <div>
                    <div className="font-semibold">{formatThaiDate(booking.date)}</div>
                    <div className="text-sm text-rimlay-driftwood">
                      {booking.time} น. · {booking.party} ท่าน
                    </div>
                  </div>
                  <StatusPill status={booking.status} />
                </article>
              ))}
            </>
          ) : null}
        </div>

        {editing ? (
          <div className="min-w-0 flex-1">
            <EditBooking
              key={editing.id}
              booking={editing}
              phone={phone}
              calendar={calendar}
              onClose={() => setEditingId(null)}
              onSaved={saved}
              onExpired={expire}
            />
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title="ยกเลิกคิวนี้?"
        description={
          cancelTarget
            ? `${formatThaiDate(cancelTarget.date)} · ${cancelTarget.time} น. · ${cancelTarget.party} ท่าน เมื่อยกเลิกแล้วจะไม่สามารถกู้คืนได้ เราจะส่งอีเมลยืนยันการยกเลิกให้คุณ`
            : ""
        }
        confirmLabel="ยืนยันยกเลิกคิว"
        cancelLabel="ไม่ยกเลิก"
        onConfirm={async () => {
          if (!cancelTarget) return;
          const result = await cancelMyBooking(cancelTarget.id);
          if (!result.ok) {
            if (result.expired) expire();
            return { error: result.error };
          }
          if (editingId === cancelTarget.id) setEditingId(null);
          setNotice(`ยกเลิกคิว ${formatThaiDate(cancelTarget.date)} เวลา ${cancelTarget.time} น. แล้ว ส่งอีเมลยืนยันไปที่ ${cancelTarget.email}`);
          router.refresh();
        }}
      />
    </main>
  );
}

function StatusPill({ status }: { status: MyBooking["status"] }) {
  return <span className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-semibold ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}
