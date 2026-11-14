"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Thin wrapper over the native <dialog>: focus trapping, Esc to close and the backdrop come
// from the browser. Children only mount while open so forms reset every time it opens.
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="modal-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-card bg-white p-0 text-rimlay-deep shadow-float backdrop:bg-rimlay-deep/40"
    >
      {open ? (
        <div className="flex flex-col gap-5 p-6">
          <div>
            <h2 id="modal-title" className="text-xl">
              {title}
            </h2>
            {description ? <p className="mt-1 text-[15px] text-rimlay-driftwood">{description}</p> : null}
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
