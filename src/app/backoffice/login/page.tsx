import { Suspense } from "react";
import type { Metadata } from "next";
import { Logo } from "@/components/brand/Logo";
import { WaveDivider } from "@/components/brand/Wave";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "เข้าสู่ระบบหลังบ้าน" };

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-wrap bg-white">
      <section className="relative flex min-h-60 flex-[1_1_420px] flex-col justify-between gap-8 overflow-hidden bg-[linear-gradient(180deg,#FFFFFF_0%,#E6F6FD_45%,#8FD6F2_100%)] p-8 pb-24 sm:p-12 sm:pb-28">
        <Logo size={44} subtitle="Back-office" />
        <div>
          <h1 className="text-3xl text-rimlay-deep sm:text-4xl">
            ระบบหลังบ้าน
            <br />
            จัดการคิวและโต๊ะ
          </h1>
          <p className="mt-3 max-w-md text-base text-rimlay-driftwood">
            รวมการจองจาก Web App, Walk-in และ Phone-in ไว้ที่เดียว
          </p>
        </div>
        <span className="relative z-10 text-[13px] text-rimlay-deep/80">สำหรับพนักงานและผู้ดูแลร้านเท่านั้น</span>
        <WaveDivider className="absolute inset-x-0 bottom-0 h-16 w-full" />
      </section>

      <main className="flex flex-[1_1_480px] items-center justify-center px-6 py-12">
        <Suspense>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  );
}
