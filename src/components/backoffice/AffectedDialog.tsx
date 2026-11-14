"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { ActionState } from "@/lib/action-state";
import type { AffectedBooking } from "@/lib/booking/affected";
import { formatThaiDate } from "@/lib/booking/format";
import { CHANNEL_LABEL } from "@/lib/booking/status";
import { Modal } from "./Modal";
import { FormError, primaryButton, secondaryButton } from "./ui";

// ADM-08: lists the bookings a settings change would affect. Nothing is saved until the Admin
// confirms, and the bookings themselves are never cancelled — the Staff phone the customers.
export function AffectedDialog({
  affected,
  onClose,
  onConfirm,
}: {
  affected: { summary: string; bookings: AffectedBooking[] } | null;
  onClose: () => void;
  onConfirm: () => Promise<ActionState | void>;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function close() {
    setError(undefined);
    onClose();
  }

  return (
    <Modal
      open={affected !== null}
      onClose={close}
      title={`มี ${affected?.bookings.length ?? 0} คิวที่ได้รับผลกระทบ`}
      description={`${affected?.summary ?? ""} · คิวเดิมจะไม่ถูกยกเลิกอัตโนมัติ กรุณาโทรประสานลูกค้าเพื่อแก้ไขคิว`}
    >
      <FormError message={error} />
      <ul className="flex max-h-72 flex-col overflow-y-auto rounded-field border border-rimlay-border">
        {affected?.bookings.map((b) => (
          <li key={b.id} className="flex items-center gap-3 border-t border-rimlay-border/60 px-3 py-2.5 first:border-t-0">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">
                {formatThaiDate(b.date)} · {b.time}
              </div>
              <div className="truncate text-[13px] text-rimlay-driftwood">
                {b.name} · {b.party} ท่าน · {CHANNEL_LABEL[b.channel]}
              </div>
            </div>
            <a
              href={`tel:${b.phone}`}
              aria-label={`โทรหา ${b.name}`}
              className="flex h-10 items-center rounded-field border border-rimlay-border px-3 text-[14px] font-semibold"
            >
              โทร
            </a>
            <Link
              href={`/backoffice/bookings/${b.id}`}
              target="_blank"
              className="flex h-10 items-center rounded-field border border-rimlay-border px-3 text-[14px] font-semibold"
            >
              แก้ไขคิว
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" className={secondaryButton} onClick={close} disabled={pending}>
          กลับไปแก้ไข
        </button>
        <button
          type="button"
          className={primaryButton}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await onConfirm();
              if (result?.error) setError(result.error);
              else close();
            })
          }
        >
          {pending ? "กำลังบันทึก…" : "ยืนยันและบันทึก"}
        </button>
      </div>
    </Modal>
  );
}
