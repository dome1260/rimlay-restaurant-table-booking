import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { Logo } from "@/components/brand/Logo";
import { loadBusinessHours } from "@/lib/booking/public";
import { bangkokNow } from "@/lib/booking/slots";
import { getNow } from "@/lib/clock";
import { SIM_CLOCK_COOKIE } from "@/lib/clock-core";
import { devToolsAllowed } from "@/lib/dev-tools";
import { STORE_INFO } from "@/lib/store/info";
import { summarizeHours } from "@/lib/store/hours-summary";

export default function CustomerLayout({ children }: LayoutProps<"/">) {
  return (
    // The booking page has a fixed summary bar on small screens; padding the whole page (not just
    // <main>) keeps the footer readable above it.
    <div className="flex min-h-dvh flex-col pb-28 lg:pb-0">
      <header className="border-b border-rimlay-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="Rimlay หน้าแรก">
            <Logo size={36} />
          </Link>
          {/* TODO(Phase 5): "ค้นหาคิวของฉัน" link (phone + OTP) goes here. */}
        </div>
      </header>
      <Suspense fallback={null}>
        <SimulatedClockBadge />
      </Suspense>
      <div className="flex-1">{children}</div>
      <footer className="border-t border-rimlay-border bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-x-6 gap-y-1 px-4 py-5 text-[13px] text-rimlay-driftwood sm:px-6">
          <span>{[STORE_INFO.name, STORE_INFO.address].filter(Boolean).join(" · ")}</span>
          <Suspense fallback={null}>
            <FooterHours />
          </Suspense>
        </div>
      </footer>
    </div>
  );
}

async function FooterHours() {
  const parts = [STORE_INFO.phone ? `โทร ${STORE_INFO.phone}` : "", summarizeHours(await loadBusinessHours())].filter(Boolean);
  return <span>{parts.join(" · ")}</span>;
}

// Development only: the booking page follows the simulated clock set from the back-office bar, so
// say so instead of letting a tester wonder why "today" is not today.
async function SimulatedClockBadge() {
  if (!devToolsAllowed() || !(await cookies()).get(SIM_CLOCK_COOKIE)) return null;
  const { date, minutes } = bangkokNow(await getNow());
  const hhmm = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  return (
    <p className="bg-amber-100 px-4 py-1.5 text-center text-[13px] font-medium text-amber-900">
      เวลาจำลอง (โหมดพัฒนา): {date} {hhmm}
    </p>
  );
}
