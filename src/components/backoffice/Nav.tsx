"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { splitBottomNav, type MenuItem } from "@/lib/auth/menu";
import { MenuIcon } from "./MenuIcon";

const GROUP_LABEL: Record<MenuItem["group"], string> = {
  frontdesk: "หน้าร้าน",
  admin: "ADMIN",
};

// Detail pages (e.g. /backoffice/bookings/[id]) keep their parent menu item highlighted;
// the home item is exact-match only because every back-office path starts with it.
function isActive(pathname: string, href: string): boolean {
  return href === "/backoffice" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function SoonBadge() {
  return (
    <span className="ml-auto shrink-0 whitespace-nowrap rounded-full bg-rimlay-shallow px-2 py-0.5 text-[11px] font-medium text-rimlay-driftwood">
      เร็วๆ นี้
    </span>
  );
}

export function SidebarNav({ items }: { items: MenuItem[] }) {
  const pathname = usePathname();
  const groups = (["frontdesk", "admin"] as const)
    .map((group) => ({ group, items: items.filter((item) => item.group === group) }))
    .filter((g) => g.items.length > 0);

  return (
    <nav aria-label="เมนูหลังบ้าน" className="flex flex-col gap-1">
      {groups.map(({ group, items: groupItems }) => (
        <div key={group} className="flex flex-col gap-1">
          <span className="px-3 pb-1 pt-4 text-[11px] font-semibold tracking-wider text-rimlay-driftwood">
            {GROUP_LABEL[group]}
          </span>
          {groupItems.map((item) => {
            const base = "flex h-11 items-center gap-3 rounded-field px-3 text-[15px]";
            if (!item.available) {
              return (
                <span key={item.key} aria-disabled="true" className={`${base} cursor-not-allowed text-rimlay-driftwood/70`}>
                  <MenuIcon name={item.icon} />
                  <span className="min-w-0 truncate">{item.label}</span>
                  <SoonBadge />
                </span>
              );
            }
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`${base} ${
                  active
                    ? "bg-rimlay-blue font-semibold text-white shadow-soft"
                    : "font-medium text-rimlay-deep hover:bg-rimlay-shallow"
                }`}
              >
                <MenuIcon name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function BottomNav({ items }: { items: MenuItem[] }) {
  const pathname = usePathname();
  const { bar, more } = splitBottomNav(items);
  const [openAt, setOpenAt] = useState<string | null>(null);
  // The sheet belongs to the page it was opened on, so navigating closes it.
  const sheetOpen = openAt === pathname;
  const moreActive = more.some((item) => isActive(pathname, item.href));
  const slots = bar.length + (more.length > 0 ? 1 : 0);
  const base = "flex min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 text-[11px]";

  return (
    <>
      {sheetOpen ? (
        <div className="fixed inset-0 z-30 md:hidden" role="presentation">
          <button
            type="button"
            aria-label="ปิดเมนู"
            className="absolute inset-0 bg-rimlay-deep/40"
            onClick={() => setOpenAt(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="เมนูเพิ่มเติม"
            className="absolute inset-x-0 bottom-0 flex flex-col gap-1 rounded-t-card bg-white p-3 pb-24 shadow-float"
            onKeyDown={(event) => event.key === "Escape" && setOpenAt(null)}
          >
            <span className="px-3 pb-1 pt-1 text-[11px] font-semibold tracking-wider text-rimlay-driftwood">ADMIN</span>
            {more.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  autoFocus={item === more[0]}
                  className={`flex h-12 items-center gap-3 rounded-field px-3 text-[16px] ${
                    active ? "bg-rimlay-blue font-semibold text-white" : "font-medium text-rimlay-deep hover:bg-rimlay-shallow"
                  }`}
                >
                  <MenuIcon name={item.icon} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <nav
        aria-label="เมนูหลัก"
        className="fixed inset-x-0 bottom-0 z-40 grid h-[72px] border-t border-rimlay-border bg-white pb-2 md:hidden"
        style={{ gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))` }}
      >
        {bar.map((item) => {
          const active = isActive(pathname, item.href) && !sheetOpen;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`${base} ${active ? "font-semibold text-rimlay-blue" : "font-medium text-rimlay-driftwood"}`}
            >
              <MenuIcon name={item.icon} size={22} />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
        {more.length > 0 ? (
          <button
            type="button"
            aria-expanded={sheetOpen}
            aria-haspopup="dialog"
            onClick={() => setOpenAt(sheetOpen ? null : pathname)}
            className={`${base} ${sheetOpen || moreActive ? "font-semibold text-rimlay-blue" : "font-medium text-rimlay-driftwood"}`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>เมนู</span>
          </button>
        ) : null}
      </nav>
    </>
  );
}
