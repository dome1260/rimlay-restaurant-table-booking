import { Suspense } from "react";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { BottomNav, SidebarNav } from "@/components/backoffice/Nav";
import { LogoutIcon } from "@/components/backoffice/MenuIcon";
import { getCurrentProfile } from "@/lib/auth/dal";
import { getMenuForRole } from "@/lib/auth/menu";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { logout } from "../login/actions";

export default function BackofficeLayout({ children }: LayoutProps<"/backoffice">) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  const menu = getMenuForRole(profile.role);
  const initial = profile.displayName.trim().charAt(0) || profile.username.charAt(0);

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-rimlay-border bg-white px-3 py-5 md:flex">
        <div className="px-2 pb-2">
          <Logo size={38} subtitle="Back-office" />
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav items={menu} />
        </div>
        <div className="flex items-center gap-3 border-t border-rimlay-border px-2 pt-4">
          <span className="flex size-9 items-center justify-center rounded-full bg-rimlay-shallow font-semibold text-rimlay-blue">
            {initial.toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{profile.displayName}</div>
            <div className="text-xs text-rimlay-driftwood">{ROLE_LABEL[profile.role]}</div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              aria-label="ออกจากระบบ"
              className="flex size-10 items-center justify-center rounded-field text-rimlay-driftwood hover:bg-rimlay-shallow hover:text-rimlay-deep"
            >
              <LogoutIcon />
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-rimlay-border bg-white px-4 py-3 md:hidden">
          <span className="flex items-center gap-2">
            <LogoMark size={32} />
            <span className="font-wordmark text-xl font-bold text-rimlay-blue">rimlay</span>
          </span>
          <form action={logout}>
            <button
              type="submit"
              className="flex h-11 items-center gap-2 rounded-field px-3 text-sm font-medium text-rimlay-driftwood hover:bg-rimlay-shallow"
            >
              <LogoutIcon />
              ออกจากระบบ
            </button>
          </form>
        </header>
        <main className="flex-1 px-4 pb-28 pt-6 sm:px-8 md:pb-10 md:pt-10">{children}</main>
      </div>

      <BottomNav items={menu} />
    </div>
  );
}

function ShellFallback() {
  return (
    <div className="flex min-h-dvh" aria-busy="true">
      <aside className="hidden w-64 shrink-0 border-r border-rimlay-border bg-white md:block" />
      <main className="flex flex-1 items-center justify-center text-rimlay-driftwood">กำลังโหลด…</main>
    </div>
  );
}
