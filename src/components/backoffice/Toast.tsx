"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";

type Kind = "success" | "warning" | "error";
type ToastItem = { id: number; kind: Kind; message: string; leaving: boolean };

export type Toaster = Record<Kind, (message: string) => void>;

const ToastContext = createContext<Toaster | null>(null);

// Visible time before the slide-out starts. Keep in sync with --animate-toast-progress in globals.css.
const DURATION_MS = 3000;
// Keep in sync with the toast-out animation length in globals.css.
const EXIT_MS = 300;

const STYLE: Record<Kind, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
};

const ICON: Record<Kind, string> = { success: "✓", warning: "!", error: "✕" };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const layer = useRef<HTMLDivElement>(null);

  // Two steps so the toast can slide out before it is removed from the DOM.
  const dismiss = useCallback((id: number) => {
    const pendingTimer = timers.current.get(id);
    if (pendingTimer) clearTimeout(pendingTimer);
    setItems((current) => current.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        setItems((current) => current.filter((t) => t.id !== id));
      }, EXIT_MS),
    );
  }, []);

  // Simultaneous results stack; each one keeps its own timer.
  const push = useCallback(
    (kind: Kind, message: string) => {
      const id = nextId.current++;
      setItems((current) => [...current, { id, kind, message, leaving: false }]);
      timers.current.set(id, setTimeout(() => dismiss(id), DURATION_MS));
    },
    [dismiss],
  );

  // A modal <dialog> sits in the browser's top layer and would cover a normal fixed element,
  // so toasts shown while a dialog is open would be invisible. A manual popover joins the top
  // layer too; re-opening it whenever a toast is added moves it above any dialog opened earlier.
  const shownCount = useRef(0);
  useEffect(() => {
    const el = layer.current;
    const added = items.length > shownCount.current;
    shownCount.current = items.length;
    if (!el || !added) return;
    try {
      if (el.matches(":popover-open")) el.hidePopover();
      el.showPopover();
    } catch {
      // Browsers without the Popover API fall back to the plain fixed layer.
    }
  }, [items]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  const toaster = useMemo<Toaster>(
    () => ({
      success: (message) => push("success", message),
      warning: (message) => push("warning", message),
      error: (message) => push("error", message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={toaster}>
      {children}
      {/* Sits above the mobile bottom nav (72px). */}
      <div
        ref={layer}
        popover="manual"
        aria-live="polite"
        className="pointer-events-none fixed inset-auto bottom-24 left-4 right-4 z-50 m-0 flex h-auto w-auto flex-col items-center gap-2 overflow-visible border-0 bg-transparent p-0 md:left-auto md:bottom-6 md:right-6 md:items-end"
      >
        {/* Newest first so a fresh toast sits on top of the stack. */}
        {[...items].reverse().map((item) => (
          <div
            key={item.id}
            role={item.kind === "success" ? "status" : "alert"}
            className={`pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-field border px-4 pb-4 pt-3 text-[15px] font-medium shadow-float motion-reduce:animate-none ${
              item.leaving ? "animate-toast-out" : "animate-toast-in"
            } ${STYLE[item.kind]}`}
          >
            <span aria-hidden="true" className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-current/15 text-xs font-bold">
              {ICON[item.kind]}
            </span>
            <span className="min-w-0 flex-1 break-words">{item.message}</span>
            <button
              type="button"
              aria-label="ปิดการแจ้งเตือน"
              onClick={() => dismiss(item.id)}
              className="-mr-1 flex size-6 shrink-0 items-center justify-center rounded text-current/70 hover:bg-black/5 hover:text-current"
            >
              ✕
            </button>
            <span
              aria-hidden="true"
              className="animate-toast-progress absolute inset-x-0 bottom-0 h-1 origin-left bg-current/35"
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Toaster {
  const toaster = useContext(ToastContext);
  if (!toaster) throw new Error("useToast must be used inside <ToastProvider>");
  return toaster;
}

// One place that decides the toast level for a Server Action result:
// success -> success, form validation / business-rule refusal -> warning, anything else -> error.
export function reportResult(toast: Toaster, result: ActionState, successMessage: string) {
  if (result.ok) return toast.success(successMessage);

  const fieldMessages = Object.values(result.fieldErrors ?? {}).filter((m): m is string => Boolean(m));
  if (fieldMessages.length > 0) {
    return toast.warning(fieldMessages.length === 1 ? fieldMessages[0] : "กรุณาตรวจสอบข้อมูลที่กรอก");
  }
  if (result.error) {
    return result.severity === "warning" ? toast.warning(result.error) : toast.error(result.error);
  }
}
