"use client";

import { useActionState, useState, useTransition, type FormEvent } from "react";
import { Switch } from "@/components/backoffice/Switch";
import { reportResult, useToast } from "@/components/backoffice/Toast";
import { FormError, PageHeader, primaryButton } from "@/components/backoffice/ui";
import type { ActionState } from "@/lib/action-state";
import { bookingWindow, EDD_MINUTES, TIME_OPTIONS, toMinutes } from "@/lib/store/quota";
import { saveBusinessHours } from "./actions";

export type DayState = { weekday: number; isOpen: boolean; open: string; close: string };

const DAY_NAMES = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

const selectClass =
  "h-10 w-24 rounded-field border border-rimlay-border bg-white px-2 text-[15px] focus:border-rimlay-blue focus:outline-none disabled:bg-rimlay-shell disabled:text-rimlay-driftwood aria-invalid:border-rose-500";

export function HoursForm({ days: initial }: { days: DayState[] }) {
  const [days, setDays] = useState(initial);
  const toast = useToast();
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const result = await saveBusinessHours(prev, formData);
    reportResult(toast, result, "บันทึกเวลาทำการแล้ว");
    return result;
  }, {});

  const [, startTransition] = useTransition();

  // Not <form action>: React resets the form after an action, which snaps these controlled
  // <select>s back to their first option (00:00) while the state still holds the real value.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }

  function patch(weekday: number, change: Partial<DayState>) {
    setDays((current) => current.map((d) => (d.weekday === weekday ? { ...d, ...change } : d)));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <PageHeader
        title="เวลาทำการ"
        description="มีผลกับวันและเวลาที่ลูกค้าเลือกจองได้ · การเปลี่ยนแปลงมีผลกับการจองใหม่เท่านั้น"
        action={
          <button type="submit" className={primaryButton} disabled={pending}>
            {pending ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        }
      />

      <FormError message={state.error} />

      <section className="overflow-x-auto rounded-card bg-white shadow-soft" aria-labelledby="weekly-heading">
        <div className="px-5 pb-2 pt-5">
          <h2 id="weekly-heading" className="text-lg">เวลาทำการรายสัปดาห์</h2>
          <p className="text-[13px] text-rimlay-driftwood">Slot ทุก 30 นาที · slot สุดท้าย = เวลาปิด − 120 นาที</p>
        </div>
        <table className="w-full min-w-[600px] border-collapse text-[15px]">
          <thead>
            <tr className="text-left text-[13px] text-rimlay-driftwood">
              <th scope="col" className="px-5 py-2 font-semibold">วัน</th>
              <th scope="col" className="px-3 py-2 font-semibold">เปิดทำการ</th>
              <th scope="col" className="px-3 py-2 font-semibold">เวลาเปิด</th>
              <th scope="col" className="px-3 py-2 font-semibold">เวลาปิด</th>
              <th scope="col" className="px-5 py-2 font-semibold">ช่วงที่รับจอง</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const rowError = state.fieldErrors?.[`day-${day.weekday}`];
              return (
                <tr key={day.weekday} className="border-t border-rimlay-border/60">
                  <th scope="row" className="px-5 py-3 text-left font-semibold">{DAY_NAMES[day.weekday]}</th>
                  <td className="px-3 py-3">
                    <Switch
                      checked={day.isOpen}
                      label={`เปิดทำการวัน${DAY_NAMES[day.weekday]}`}
                      onChange={(next) => patch(day.weekday, { isOpen: next })}
                    />
                    {day.isOpen ? <input type="hidden" name={`open-${day.weekday}`} value="on" /> : null}
                  </td>
                  <td className="px-3 py-3">
                    <select
                      name={`from-${day.weekday}`}
                      aria-label={`เวลาเปิดวัน${DAY_NAMES[day.weekday]}`}
                      disabled={!day.isOpen}
                      value={day.open}
                      onChange={(e) => patch(day.weekday, { open: e.target.value })}
                      className={selectClass}
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      name={`to-${day.weekday}`}
                      aria-label={`เวลาปิดวัน${DAY_NAMES[day.weekday]}`}
                      disabled={!day.isOpen}
                      value={day.close}
                      aria-invalid={rowError ? true : undefined}
                      onChange={(e) => patch(day.weekday, { close: e.target.value })}
                      className={selectClass}
                    >
                      {TIME_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3 text-sm">
                    {!day.isOpen ? (
                      <span className="text-rimlay-driftwood">ร้านปิด</span>
                    ) : rowError || toMinutes(day.close) - toMinutes(day.open) < EDD_MINUTES ? (
                      <span className="text-rose-700">{rowError ?? "เวลาปิดต้องห่างจากเวลาเปิดอย่างน้อย 2 ชั่วโมง"}</span>
                    ) : (
                      bookingWindow(day.open, day.close)
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </form>
  );
}
