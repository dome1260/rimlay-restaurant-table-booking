"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MenuItem } from "@/lib/auth/menu";
import { MenuIcon } from "./MenuIcon";

const GROUP_LABEL: Record<MenuItem["group"], string> = {
  frontdesk: "หน้าร้าน",
  admin: "ADMIN",
};

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
            const active = pathname === item.href;
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
  // Only pages that exist are reachable from the bar; showing "coming soon" items pushed
  // the Admin pages out of the first four slots on phones.
  // TODO(Phase 2/3): with 5+ available items (bookings, calendar, dashboard arrive) the bar
  // needs a "more" sheet instead of silently dropping the rest.
  const shown = items.filter((item) => item.available).slice(0, 4);

  return (
    <nav
      aria-label="เมนูหลัก"
      className="fixed inset-x-0 bottom-0 z-20 grid h-[72px] border-t border-rimlay-border bg-white pb-2 md:hidden"
      style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}
    >
      {shown.map((item) => {
        const base = "flex flex-col items-center justify-center gap-0.5 text-[11px]";
        const active = pathname === item.href;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`${base} ${active ? "font-semibold text-rimlay-blue" : "font-medium text-rimlay-driftwood"}`}
          >
            <MenuIcon name={item.icon} size={22} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
