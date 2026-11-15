"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "จองโต๊ะ" },
  { href: "/my-booking", label: "ค้นหาคิวของฉัน" },
];

export function CustomerNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="เมนูหลัก" className="flex gap-1">
      {LINKS.map((link) => {
        const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`flex h-11 items-center rounded-field px-3.5 text-[15px] transition-colors ${
              active ? "bg-rimlay-shallow font-semibold text-rimlay-blue" : "font-medium text-rimlay-deep hover:bg-rimlay-shell"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
