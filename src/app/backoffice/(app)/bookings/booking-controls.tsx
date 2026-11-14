"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/backoffice/ConfirmDialog";
import { Modal } from "@/components/backoffice/Modal";
import { reportResult, useToast } from "@/components/backoffice/Toast";
import { dangerSmallButton, primaryButton, secondaryButton } from "@/components/backoffice/ui";
import { ACTION_LABEL, allowedActions, nextAction, type BookingAction, type BookingStatus } from "@/lib/booking/status";
import { cancelBooking, closeTable, markArrived } from "./actions";
import { BookingForm, type EditableBooking } from "./booking-form";

export function CreateBookingButton({ today, maxDate }: { today: string; maxDate: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={primaryButton} onClick={() => setOpen(true)}>
        + สร้างคิว
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="สร้างคิวใหม่" description="สำหรับลูกค้า walk-in หรือจองทางโทรศัพท์">
        {open ? <BookingForm today={today} maxDate={maxDate} onDone={() => setOpen(false)} /> : null}
      </Modal>
    </>
  );
}

// The single next step of a booking, used on the list rows and the detail header.
export function NextActionButton({
  id,
  status,
  name,
  compact,
}: {
  id: string;
  status: BookingStatus;
  name: string;
  compact?: boolean;
}) {
  const action = nextAction(status);
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  if (!action) return null;
  const size = compact ? "h-10 px-3.5 text-sm" : "h-11 px-5 text-[15px]";
  const base = `inline-flex items-center justify-center whitespace-nowrap rounded-full bg-rimlay-blue font-semibold text-white hover:bg-rimlay-blue-hover disabled:opacity-60 ${size}`;

  if (action === "assign") {
    return (
      <Link href={`/backoffice/bookings/${id}#assign`} className={base}>
        {ACTION_LABEL.assign}
      </Link>
    );
  }

  const arriving = action === "arrive";
  return (
    <>
      <button type="button" className={base} onClick={() => setConfirming(true)}>
        {arriving ? ACTION_LABEL.arrive : ACTION_LABEL.close}
      </button>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        tone="primary"
        title={arriving ? `${name} มาถึงแล้ว?` : `ปิดโต๊ะของ ${name}?`}
        description={
          arriving
            ? "เปลี่ยนสถานะเป็น “ลูกค้ามาถึงแล้ว” เพื่อรอจัดโต๊ะ"
            : "ลูกค้าทานเสร็จแล้ว โต๊ะจะว่างและคืนที่นั่งทันที ปิดโต๊ะแล้วย้อนกลับไม่ได้"
        }
        confirmLabel={arriving ? "ยืนยัน ลูกค้ามาถึงแล้ว" : "ปิดโต๊ะ"}
        onConfirm={async () => {
          const result = arriving ? await markArrived(id) : await closeTable(id);
          reportResult(toast, result, arriving ? `${name} มาถึงแล้ว` : `ปิดโต๊ะของ ${name} แล้ว`);
          return result;
        }}
      />
    </>
  );
}

export function DetailActions({
  booking,
  status,
  today,
  maxDate,
  label,
}: {
  booking: EditableBooking;
  status: BookingStatus;
  today: string;
  maxDate: string;
  label: string;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const actions: BookingAction[] = allowedActions(status);

  if (actions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {actions.includes("arrive") || actions.includes("close") ? (
        <NextActionButton id={booking.id} status={status} name={booking.name} />
      ) : null}
      {actions.includes("edit") ? (
        <button type="button" className={secondaryButton} onClick={() => setEditing(true)}>
          {ACTION_LABEL.edit}
        </button>
      ) : null}
      {actions.includes("cancel") ? (
        <button type="button" className={`${dangerSmallButton} h-11 rounded-full px-5 text-[15px]`} onClick={() => setCancelling(true)}>
          {ACTION_LABEL.cancel}
        </button>
      ) : null}

      <Modal open={editing} onClose={() => setEditing(false)} title={`แก้ไขคิว ${label}`}>
        {editing ? <BookingForm today={today} maxDate={maxDate} booking={booking} onDone={() => setEditing(false)} /> : null}
      </Modal>
      <ConfirmDialog
        open={cancelling}
        onClose={() => setCancelling(false)}
        title={`ยกเลิกคิวของ ${booking.name}?`}
        description="คืนที่นั่งทันที และส่งอีเมลแจ้งลูกค้า (ถ้ามีอีเมล) ยกเลิกแล้วย้อนกลับไม่ได้"
        confirmLabel="ยกเลิกคิว"
        onConfirm={async () => {
          const result = await cancelBooking(booking.id);
          reportResult(toast, result, `ยกเลิกคิวของ ${booking.name} แล้ว`);
          return result;
        }}
      />
    </div>
  );
}
