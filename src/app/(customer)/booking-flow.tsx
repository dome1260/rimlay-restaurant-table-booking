"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Field, FormError, inputClass, primaryButton, secondaryButton } from "@/components/backoffice/ui";
import { formatThaiDate } from "@/lib/booking/format";
import { formatPhone } from "@/lib/booking/phone";
import type { PublicCalendar } from "@/lib/booking/customer-calendar";
import { STATUS_LABEL, STATUS_STYLE } from "@/lib/booking/status";
import { MonthCalendar } from "./_components/month-calendar";
import { SeatPicker } from "./_components/seat-picker";
import { SlotGrid, useSlotLoader } from "./_components/slot-grid";
import { createWebBooking, getPublicSlots, type WebBookingState } from "./actions";

export function BookingFlow({ calendar }: { calendar: PublicCalendar }) {
  const [round, setRound] = useState(0);
  return <Booking key={round} calendar={calendar} onAgain={() => setRound((n) => n + 1)} />;
}

function Booking({ calendar, onAgain }: { calendar: PublicCalendar; onAgain: () => void }) {
  const [party, setParty] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [rawTime, setRawTime] = useState("");
  const { slotState, load: loadSlots } = useSlotLoader((d, p) => getPublicSlots({ date: d, party: p }));

  const [state, action, pending] = useActionState<WebBookingState, FormData>(async (prev, formData) => {
    const result = await createWebBooking(prev, formData);
    // The slot may have been taken meanwhile: show the current list again.
    if (!result.done) loadSlots(date, party);
    return result;
  }, {});

  const time = slotState.slots.includes(rawTime) ? rawTime : "";
  const complete = Boolean(party && date && time) && !slotState.loading;
  const errors = state.fieldErrors ?? {};
  const aria = (name: string) => ({
    "aria-invalid": errors[name] ? (true as const) : undefined,
    "aria-describedby": errors[name] ? `web-${name}-error` : undefined,
  });

  if (state.done) return <Done done={state.done} onAgain={onAgain} />;

  return (
    <form action={action} noValidate className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={time} />
      <input type="hidden" name="party" value={party ?? ""} />
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        {/* Honeypot: a name no autofill profile maps to, and opted out of password managers. */}
        <label>
          เว้นช่องนี้ว่างไว้
          <input
            name="hp_token"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            data-1p-ignore=""
            data-lpignore="true"
            data-bwignore=""
            data-form-type="other"
            defaultValue=""
          />
        </label>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <Step number={1} title="จำนวนที่นั่ง" hint="เลือกได้ 1–8 ท่าน">
          <SeatPicker
            value={party}
            onChange={(n) => {
              setParty(n);
              loadSlots(date, n);
            }}
          />
          {errors.party ? <p className="mt-2 text-sm text-rose-700">{errors.party}</p> : null}
        </Step>

        <Step number={2} title="เลือกวันที่" hint="ร้านปิดและวันหยุดพิเศษเลือกไม่ได้">
          <MonthCalendar
            calendar={calendar}
            date={date}
            onSelect={(d) => {
              setDate(d);
              loadSlots(d, party);
            }}
          />
          {errors.date ? <p className="mt-2 text-sm text-rose-700">{errors.date}</p> : null}
        </Step>

        <Step
          number={3}
          title="เลือกเวลา"
          hint={party ? `เฉพาะเวลาที่ยังว่างสำหรับ ${party} ท่าน · ปิดรับจอง 15 นาทีก่อนเวลาเริ่ม` : "เลือกจำนวนที่นั่งและวันที่ก่อน"}
        >
          <SlotGrid
            party={party}
            date={date}
            slotState={slotState}
            time={time}
            onSelect={setRawTime}
            onRetry={() => loadSlots(date, party)}
          />
          {errors.time ? <p className="mt-2 text-sm text-rose-700">{errors.time}</p> : null}
        </Step>

        <Step number={4} title="ข้อมูลผู้จอง">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="web-name" label="ชื่อผู้จอง *" error={errors.name}>
              <input
                id="web-name"
                name="name"
                autoComplete="name"
                defaultValue={state.values?.name ?? ""}
                className={inputClass}
                {...aria("name")}
              />
            </Field>
            <Field id="web-phone" label="เบอร์โทรศัพท์ *" error={errors.phone} hint="ใช้ค้นหาคิว · 1 เบอร์จองได้ 1 คิวต่อวัน">
              <input
                id="web-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                defaultValue={state.values?.phone ?? ""}
                className={inputClass}
                {...aria("phone")}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field id="web-email" label="อีเมล *" error={errors.email} hint="ใช้รับรหัส OTP และอีเมลแจ้งเตือนเมื่อคิวมีการเปลี่ยนแปลง">
                <input
                  id="web-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  defaultValue={state.values?.email ?? ""}
                  className={inputClass}
                  {...aria("email")}
                />
              </Field>
            </div>
          </div>
        </Step>
      </div>

      <aside className="hidden w-full shrink-0 flex-col gap-4 rounded-card border border-rimlay-border bg-white p-6 shadow-soft lg:sticky lg:top-6 lg:flex lg:w-80">
        <h2 className="text-lg">สรุปการจอง</h2>
        <Summary date={date} time={time} party={party} />
        <FormError message={state.error} />
        <button type="submit" disabled={!complete || pending} className={`${primaryButton} h-12 w-full`}>
          {pending ? "กำลังจอง…" : "ยืนยันการจอง"}
        </button>
        <Rules />
      </aside>

      <div data-fixed-bar="" className="fixed inset-x-0 bottom-0 z-20 border-t border-rimlay-border bg-white px-4 pb-5 pt-3 shadow-float lg:hidden">
        <FormError message={state.error} />
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold">
              {date && time ? `${formatThaiDate(date)} · ${time}` : "ยังไม่ได้เลือกวันและเวลา"}
            </div>
            <div className="text-[13px] text-rimlay-driftwood">{party ? `${party} ท่าน` : "ยังไม่ได้เลือกจำนวน"}</div>
          </div>
          <button type="submit" disabled={!complete || pending} className={`${primaryButton} h-12 shrink-0`}>
            {pending ? "กำลังจอง…" : "ยืนยันการจอง"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Step({ number, title, hint, children }: { number: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-rimlay-border bg-white p-5 shadow-soft sm:p-6">
      <h2 className="flex items-center gap-3 text-lg">
        <span className="flex size-7 items-center justify-center rounded-full bg-rimlay-blue text-sm font-semibold text-white">{number}</span>
        {title}
      </h2>
      {hint ? <p className="mb-4 ml-10 mt-0.5 text-sm text-rimlay-driftwood">{hint}</p> : <div className="mb-4" />}
      {children}
    </section>
  );
}

function Summary({ date, time, party }: { date: string; time: string; party: number | null }) {
  const row = (label: string, value: string) => (
    <div className="flex justify-between gap-3">
      <dt className="text-rimlay-driftwood">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
  return (
    <dl className="flex flex-col gap-3 text-[15px]">
      {row("วันที่", date ? formatThaiDate(date) : "-")}
      {row("เวลา", time ? `${time} น.` : "-")}
      {row("จำนวน", party ? `${party} ท่าน` : "-")}
    </dl>
  );
}

function Rules() {
  return (
    <div className="flex flex-col gap-2 rounded-field bg-rimlay-shell p-3.5 text-[13px] leading-relaxed text-rimlay-driftwood">
      <p>แก้ไขหรือยกเลิกได้จนถึง 15 นาทีก่อนเวลานัด</p>
      <p>หากมาช้ากว่าเวลานัดเกิน 15 นาที ร้านขอสงวนสิทธิ์ปล่อยโต๊ะ</p>
    </div>
  );
}

// Shown in place of the form so there is no URL carrying the booking or customer details.
function Done({ done, onAgain }: { done: NonNullable<WebBookingState["done"]>; onAgain: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3">
      <span className="text-rimlay-driftwood">{label}</span>
      <strong className="text-right">{value}</strong>
    </div>
  );
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-5 rounded-card border border-rimlay-border bg-white p-8 text-center shadow-soft">
      <span className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <div>
        <h2 ref={heading} tabIndex={-1} className="text-2xl outline-none">
          จองสำเร็จ
        </h2>
        <p className="mt-2 text-[15px] text-rimlay-driftwood">
          ส่งอีเมลยืนยันไปที่ <strong className="break-all text-rimlay-deep">{done.email}</strong> แล้ว
        </p>
      </div>
      <div className="flex w-full flex-col gap-3 rounded-field bg-rimlay-shell p-5 text-left text-[15px]">
        {row("สถานะ", <span className={`rounded-full px-3 py-1 text-[13px] font-semibold ${STATUS_STYLE.waiting}`}>{STATUS_LABEL.waiting}</span>)}
        {row("วันที่", formatThaiDate(done.date))}
        {row("เวลา", `${done.time} น.`)}
        {row("จำนวน", `${done.party} ท่าน`)}
        {row("ผู้จอง", `${done.name} · ${formatPhone(done.phone)}`)}
      </div>
      <p className="text-sm leading-relaxed text-rimlay-driftwood">
        กรุณามาถึงร้านตามเวลานัด หากเลยเวลา 15 นาที ระบบจะปล่อยโต๊ะอัตโนมัติ
      </p>
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <Link href="/my-booking" className={`${primaryButton} w-full sm:flex-1`}>
          จัดการคิวของฉัน
        </Link>
        <button type="button" onClick={onAgain} className={`${secondaryButton} w-full sm:flex-1`}>
          จองโต๊ะอีกครั้ง
        </button>
      </div>
    </div>
  );
}
