"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Field, FormError, inputClass, primaryButton } from "@/components/backoffice/ui";
import { formatPhone, isValidPhone, normalizePhone } from "@/lib/booking/phone";
import { requestOtp, verifyOtp } from "./actions";

type Otp = {
  maskedEmail: string;
  // Deadlines are local timestamps built from the seconds the server reports, so they stay right
  // under the simulated dev clock.
  expiresAt: number;
  resendAt: number;
};

function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function FindBooking({ notice }: { notice?: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState<Otp | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>(notice);
  const [lockedUntil, setLockedUntil] = useState(0);
  // Masked emails when the phone's bookings use more than one; `choice` is the picked 1-based index
  // and is reused when asking for a new code.
  const [choices, setChoices] = useState<string[] | null>(null);
  const [choice, setChoice] = useState<number | undefined>();
  const [pending, startTransition] = useTransition();
  // Both actions share one transition; remember which one runs so the right button says so.
  const [running, setRunning] = useState<"send" | "verify">("send");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const seconds = (deadline: number) => Math.max(0, Math.ceil((deadline - now) / 1000));
  const lockRemaining = seconds(lockedUntil);
  const locked = lockRemaining > 0;
  const expiresIn = otp ? seconds(otp.expiresAt) : 0;
  const resendIn = otp ? seconds(otp.resendAt) : 0;

  function sendCode(picked = choice) {
    setRunning("send");
    setError(undefined);
    startTransition(async () => {
      const result = await requestOtp(phone, picked);
      const at = Date.now();
      setNow(at);
      if ("choose" in result) {
        setChoices(result.choose);
        setChoice(undefined);
        return;
      }
      if (result.ok) {
        setChoice(picked);
        setOtp({ maskedEmail: result.maskedEmail, expiresAt: at + result.expiresIn * 1000, resendAt: at + result.resendIn * 1000 });
        setCode("");
        return;
      }
      setError(result.error);
      if (result.locked && result.retryIn) setLockedUntil(at + result.retryIn * 1000);
      else if (result.retryIn && otp) setOtp({ ...otp, resendAt: at + result.retryIn * 1000 });
    });
  }

  function submitCode() {
    setRunning("verify");
    setError(undefined);
    startTransition(async () => {
      const result = await verifyOtp(phone, code);
      if (result.ok) {
        // Drops a leftover ?expired=1 so it can't show again after a later sign-out.
        router.replace("/my-booking");
        router.refresh();
        return;
      }
      const at = Date.now();
      setNow(at);
      setError(result.error);
      setCode("");
      if (result.locked && result.retryIn) setLockedUntil(at + result.retryIn * 1000);
      if (result.expired && otp) setOtp({ ...otp, expiresAt: at });
    });
  }

  function changePhone() {
    setOtp(null);
    setChoices(null);
    setChoice(undefined);
    setCode("");
    setError(undefined);
  }

  const phoneReady = isValidPhone(phone);

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
      <div>
        <h1 className="text-2xl sm:text-3xl">ค้นหาคิวของฉัน</h1>
        <p className="mt-1 text-rimlay-driftwood">กรอกเบอร์โทรศัพท์ที่ใช้จอง เราจะส่งรหัส OTP ไปยังอีเมลที่ผูกกับการจอง</p>
      </div>

      <ol className="flex gap-2 text-sm">
        <StepDot number={1} label="เบอร์โทรศัพท์" state={otp ? "done" : "current"} />
        <StepDot number={2} label="ยืนยัน OTP" state={otp ? "current" : "todo"} />
        <StepDot number={3} label="ดูคิว" state="todo" />
      </ol>

      <section className="flex flex-col gap-4 rounded-card border border-rimlay-border bg-white p-5 shadow-soft sm:p-6">
        {!otp ? (
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (phoneReady && !locked && !pending) sendCode();
            }}
            className="flex flex-col gap-4"
          >
            <Field id="find-phone" label="เบอร์โทรศัพท์" hint="มือถือไทย 10 หลัก เช่น 081-234-5678">
              <input
                id="find-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setChoices(null);
                  setChoice(undefined);
                }}
                className={inputClass}
              />
            </Field>
            {choices ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">เบอร์นี้จองไว้กับหลายอีเมล เลือกอีเมลของคุณเพื่อรับรหัส</legend>
                {choices.map((masked, index) => (
                  <label
                    key={masked + index}
                    className="flex h-11 cursor-pointer items-center gap-3 rounded-field border border-rimlay-border bg-white px-3.5 text-[15px] has-checked:border-rimlay-blue has-checked:bg-rimlay-shallow"
                  >
                    <input
                      type="radio"
                      name="otp-email"
                      checked={choice === index + 1}
                      onChange={() => setChoice(index + 1)}
                      className="accent-rimlay-blue"
                    />
                    <span className="break-all">{masked}</span>
                  </label>
                ))}
              </fieldset>
            ) : null}
            <LockNotice remaining={lockRemaining} />
            {!locked ? <FormError message={error} /> : null}
            <button
              type="submit"
              disabled={!phoneReady || locked || pending || (choices !== null && choice === undefined)}
              className={`${primaryButton} h-12 w-full`}
            >
              {pending && running === "send" ? "กำลังส่งรหัส…" : "ส่งรหัส OTP"}
            </button>
          </form>
        ) : (
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (code.length === 6 && !locked && !pending) submitCode();
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex items-center justify-between gap-3 rounded-field bg-rimlay-shell px-3.5 py-3 text-[15px]">
              <strong>{formatPhone(normalizePhone(phone))}</strong>
              <button type="button" onClick={changePhone} className="text-sm font-semibold text-rimlay-blue hover:underline">
                เปลี่ยนเบอร์
              </button>
            </div>
            <div>
              <h2 className="text-lg">กรอกรหัส OTP 6 หลัก</h2>
              <p className="mt-1 text-sm text-rimlay-driftwood">
                ส่งไปที่ <span className="break-all">{otp.maskedEmail}</span>
                {locked ? null : expiresIn > 0 ? (
                  <>
                    {" "}
                    · รหัสหมดอายุใน <strong className="text-rimlay-deep">{formatCountdown(expiresIn)}</strong>
                  </>
                ) : (
                  " · รหัสหมดอายุแล้ว กรุณาขอรหัสใหม่"
                )}
              </p>
            </div>
            <input
              aria-label="รหัส OTP 6 หลัก"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              disabled={locked}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              aria-invalid={error && !locked ? true : undefined}
              className="h-14 w-full rounded-field border border-rimlay-border bg-white text-center text-2xl font-semibold tracking-[0.5em] text-rimlay-deep focus:border-rimlay-blue focus:outline-none focus-visible:outline-2 focus-visible:outline-rimlay-blue aria-invalid:border-rose-500 disabled:bg-rimlay-shell"
            />
            <LockNotice remaining={lockRemaining} />
            {!locked ? <FormError message={error} /> : null}
            <button type="submit" disabled={code.length !== 6 || locked || pending} className={`${primaryButton} h-12 w-full`}>
              {pending && running === "verify" ? "กำลังตรวจสอบ…" : "ยืนยันรหัส"}
            </button>
            <div className="flex flex-wrap items-center justify-center gap-1.5 text-sm text-rimlay-driftwood">
              ไม่ได้รับรหัส?
              <button
                type="button"
                disabled={resendIn > 0 || locked || pending}
                onClick={() => sendCode()}
                className="font-semibold text-rimlay-blue hover:underline disabled:cursor-not-allowed disabled:text-rimlay-driftwood disabled:no-underline"
              >
                {resendIn > 0 ? `ขอรหัสใหม่ได้ใน ${formatCountdown(resendIn)}` : "ขอรหัสใหม่"}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}

function LockNotice({ remaining }: { remaining: number }) {
  if (remaining <= 0) return null;
  return (
    <div role="alert" className="flex gap-2.5 rounded-field border border-rose-200 bg-rose-50 p-3.5 text-sm leading-relaxed text-rose-800">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <div>
        <strong>เบอร์นี้ถูกล็อกชั่วคราว</strong>
        <br />
        กรอกรหัสผิดครบ 5 ครั้ง ลองใหม่ได้ในอีก <strong>{formatCountdown(remaining)}</strong> นาที
      </div>
    </div>
  );
}

function StepDot({ number, label, state }: { number: number; label: string; state: "done" | "current" | "todo" }) {
  const tone =
    state === "done"
      ? "bg-rimlay-blue text-white"
      : state === "current"
        ? "border-2 border-rimlay-blue text-rimlay-blue"
        : "border-2 border-rimlay-border text-rimlay-driftwood";
  return (
    <li aria-current={state === "current" ? "step" : undefined} className={`flex flex-1 items-center gap-2 ${state === "todo" ? "text-rimlay-driftwood" : "font-semibold"}`}>
      <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${tone}`}>
        {state === "done" ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          number
        )}
      </span>
      {label}
    </li>
  );
}
