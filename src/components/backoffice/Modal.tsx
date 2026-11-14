"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Thin wrapper over the native <dialog>: focus trapping, Esc to close and the backdrop come
// from the browser. Children only mount while open so forms reset every time it opens.
// Clicking the backdrop closes it; a press that starts inside the content (e.g. selecting text)
// and ends on the backdrop does not.
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
  const pressedBackdrop = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    // Closing on cleanup matters when the page is kept alive while the user navigates away
    // (back/forward cache): the native dialog would otherwise come back open without its backdrop.
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onMouseDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressedBackdrop.current && event.target === event.currentTarget) onClose();
        pressedBackdrop.current = false;
      }}
      aria-labelledby="modal-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-card bg-white p-0 text-rimlay-deep shadow-float backdrop:bg-rimlay-deep/40"
    >
      {open ? (
        <div className="flex flex-col gap-5 p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="modal-title" className="text-xl">
                {title}
              </h2>
              {description ? <p className="mt-1 text-[15px] text-rimlay-driftwood">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิด"
              className="-mr-2 -mt-1 flex size-10 shrink-0 items-center justify-center rounded-field text-rimlay-driftwood hover:bg-rimlay-shallow hover:text-rimlay-deep"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
