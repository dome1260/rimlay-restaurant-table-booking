"use client";

import { useActionState, useState, useTransition } from "react";
import { reportResult, useToast } from "@/components/backoffice/Toast";
import { Field, FormError, inputClass, secondaryButton } from "@/components/backoffice/ui";
import { submittedValues, type ActionState } from "@/lib/action-state";
import { addHoliday, removeHoliday } from "./actions";

type Holiday = { id: string; holiday_date: string; note: string | null };

const WEEKDAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];
const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// Built by hand instead of toLocaleDateString("th-TH"): Node and the browser ship different
// ICU data (e.g. "อังคาร" vs "อ."), which made server and client HTML differ and broke hydration.
function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear() + 543}`;
}

export function HolidaysCard({ holidays, today }: { holidays: Holiday[]; today: string }) {
  const toast = useToast();
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const result = await addHoliday(prev, formData);
    reportResult(toast, result, `เพิ่มวันหยุดพิเศษ ${formatDate(String(formData.get("date") ?? ""))} แล้ว`);
    return { ...result, values: submittedValues(formData) };
  }, {});
  const [removingId, setRemovingId] = useState<string>();
  const [, startTransition] = useTransition();

  function remove(holiday: Holiday) {
    setRemovingId(holiday.id);
    startTransition(async () => {
      const result = await removeHoliday(holiday.id);
      reportResult(toast, result, `ลบวันหยุด ${formatDate(holiday.holiday_date)} แล้ว`);
      setRemovingId(undefined);
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-card bg-white p-5 shadow-soft" aria-labelledby="holiday-heading">
      <div>
        <h2 id="holiday-heading" className="text-lg">วันหยุดพิเศษ</h2>
        <p className="text-[13px] text-rimlay-driftwood">ปิดทั้งวัน ลูกค้าจองวันนั้นไม่ได้</p>
      </div>

      {/* key resets the fields after each successful add */}
      <form action={action} key={state.nonce ?? 0} noValidate className="flex flex-col gap-3">
        <FormError message={state.error} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-40 flex-1">
            <Field id="holiday-date" label="เพิ่มวันที่" error={state.fieldErrors?.date}>
              <input
                id="holiday-date"
                name="date"
                type="date"
                min={today}
                defaultValue={state.ok ? "" : (state.values?.date ?? "")}
                aria-invalid={Boolean(state.fieldErrors?.date) || undefined}
                aria-describedby={state.fieldErrors?.date ? "holiday-date-error" : undefined}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="min-w-40 flex-1">
            <Field id="holiday-note" label="หมายเหตุ (ไม่บังคับ)" error={state.fieldErrors?.note}>
              <input id="holiday-note" name="note" maxLength={100} defaultValue={state.ok ? "" : (state.values?.note ?? "")} autoComplete="off" className={inputClass} />
            </Field>
          </div>
          <button type="submit" className={secondaryButton} disabled={pending}>
            {pending ? "กำลังเพิ่ม…" : "เพิ่ม"}
          </button>
        </div>
      </form>

      {holidays.length === 0 ? (
        <p className="text-[15px] text-rimlay-driftwood">ยังไม่มีวันหยุดพิเศษที่กำลังจะถึง</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {holidays.map((h) => (
            <li key={h.id} className="flex items-center gap-3 rounded-field border border-rimlay-border px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{formatDate(h.holiday_date)}</span>
                {h.note ? <span className="block truncate text-[13px] text-rimlay-driftwood">{h.note}</span> : null}
              </span>
              <button
                type="button"
                aria-label={`ลบวันหยุด ${formatDate(h.holiday_date)}`}
                disabled={removingId === h.id}
                onClick={() => remove(h)}
                className="flex size-9 items-center justify-center rounded-field text-rimlay-driftwood hover:bg-rimlay-shallow hover:text-rimlay-deep disabled:opacity-50"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
