import type { ReactNode } from "react";

export const inputClass =
  "h-11 w-full rounded-field border border-rimlay-border bg-white px-3 text-[15px] text-rimlay-deep placeholder:text-rimlay-driftwood/70 focus:border-rimlay-blue focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-rimlay-blue aria-invalid:border-rose-500 disabled:bg-rimlay-shell disabled:text-rimlay-driftwood";

export const primaryButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-rimlay-blue px-5 text-[15px] font-semibold text-white shadow-soft transition-colors hover:bg-rimlay-blue-hover disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-rimlay-border bg-white px-5 text-[15px] font-semibold text-rimlay-deep transition-colors hover:bg-rimlay-shallow disabled:cursor-not-allowed disabled:opacity-60";

export const smallButton =
  "inline-flex h-9 items-center justify-center rounded-field border border-rimlay-border bg-white px-3 text-sm font-semibold text-rimlay-deep hover:bg-rimlay-shallow disabled:cursor-not-allowed disabled:opacity-50";

export const dangerSmallButton =
  "inline-flex h-9 items-center justify-center rounded-field border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-rimlay-border disabled:text-rimlay-driftwood/60 disabled:hover:bg-white";

export const dangerButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-rose-600 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60";

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-rimlay-driftwood">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error ? <span className="text-[13px] text-rimlay-driftwood">{hint}</span> : null}
      {error ? (
        <span id={`${id}-error`} className="text-sm text-rose-700">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-field border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
      {message}
    </p>
  );
}

export function RolePill({ role }: { role: "staff" | "admin" }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-[13px] font-semibold ${
        role === "admin" ? "bg-rimlay-blue text-white" : "bg-rimlay-shallow text-rimlay-blue"
      }`}
    >
      {role === "admin" ? "Admin" : "Staff"}
    </span>
  );
}
