import Link from "next/link";
import type { Route } from "next";
import { pageNumbers } from "@/lib/pagination";

const box = "flex size-10 items-center justify-center rounded-field text-sm font-semibold";

// Plain links (?page=N) so it works from server and client components alike and the page
// survives a reload / back button. Hidden when everything fits on one page.
export function Pagination({
  page,
  totalPages,
  total,
  from,
  to,
  unit,
  href,
}: {
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
  unit: string;
  href: (page: number) => string;
}) {
  const summary = (
    <p className="text-xs text-rimlay-driftwood" data-testid="pagination-summary">
      {total === 0 ? `ไม่มี${unit}` : `แสดง ${from}–${to} จาก ${total} ${unit}`}
    </p>
  );
  if (totalPages <= 1) return summary;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {summary}
      <nav aria-label="เปลี่ยนหน้า" className="flex items-center gap-1">
        <PageLink to={page - 1} disabled={page <= 1} href={href} label="หน้าก่อนหน้า">
          ‹
        </PageLink>
        {pageNumbers(page, totalPages).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} className={`${box} text-rimlay-driftwood`} aria-hidden="true">
              …
            </span>
          ) : p === page ? (
            <span key={p} aria-current="page" className={`${box} bg-rimlay-deep text-white`}>
              {p}
            </span>
          ) : (
            <Link
              key={p}
              href={href(p) as Route}
              aria-label={`หน้า ${p}`}
              className={`${box} border border-rimlay-border bg-white text-rimlay-deep hover:bg-rimlay-shallow`}
            >
              {p}
            </Link>
          ),
        )}
        <PageLink to={page + 1} disabled={page >= totalPages} href={href} label="หน้าถัดไป">
          ›
        </PageLink>
      </nav>
    </div>
  );
}

function PageLink({
  to,
  disabled,
  href,
  label,
  children,
}: {
  to: number;
  disabled: boolean;
  href: (page: number) => string;
  label: string;
  children: string;
}) {
  if (disabled) {
    return (
      <span aria-hidden="true" className={`${box} border border-rimlay-border bg-white text-rimlay-driftwood/40`}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href(to) as Route}
      aria-label={label}
      className={`${box} border border-rimlay-border bg-white text-rimlay-deep hover:bg-rimlay-shallow`}
    >
      {children}
    </Link>
  );
}
