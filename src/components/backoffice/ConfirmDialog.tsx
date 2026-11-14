"use client";

import { useState, useTransition } from "react";
import type { ActionState } from "@/lib/action-state";
import { Modal } from "./Modal";
import { dangerButton, FormError, secondaryButton } from "./ui";

// Confirmation step for destructive actions. Stays open and shows the message if the
// action is refused (e.g. last Admin).
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<ActionState | void>;
}) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function close() {
    setError(undefined);
    onClose();
  }

  return (
    <Modal open={open} onClose={close} title={title} description={description}>
      <FormError message={error} />
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" className={secondaryButton} onClick={close} disabled={pending}>
          ยกเลิก
        </button>
        <button
          type="button"
          className={dangerButton}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await onConfirm();
              if (result?.error) setError(result.error);
              else close();
            })
          }
        >
          {pending ? "กำลังดำเนินการ…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
