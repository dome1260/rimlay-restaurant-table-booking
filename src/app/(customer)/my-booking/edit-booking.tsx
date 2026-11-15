"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Field, FormError, inputClass, primaryButton, secondaryButton } from "@/components/backoffice/ui";
import type { PublicCalendar } from "@/lib/booking/customer-calendar";
import { formatThaiDate } from "@/lib/booking/format";
import { formatPhone } from "@/lib/booking/phone";
import type { MyBooking } from "@/lib/customer/bookings";
import { MonthCalendar } from "../_components/month-calendar";
import { SeatPicker } from "../_components/seat-picker";
import { SlotGrid, useSlotLoader } from "../_components/slot-grid";
import { getMyEditSlots, updateMyBooking, type MyEditState } from "./actions";

export function EditBooking({
  booking,
  phone,
  calendar,
  onClose,
  onSaved,
  onExpired,
}: {
  booking: MyBooking;
  phone: string;
  calendar: PublicCalendar;
  onClose: () => void;
  onSaved: (done: NonNullable<MyEditState["done"]>) => void;
  onExpired: () => void;
}) {
  // On a phone the panel sits below the list; bring it into view when it opens.
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!window.matchMedia("(min-width: 64rem)").matches) {
      formRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, []);

  const [party, setParty] = useState<number | null>(booking.party);
  const [date, setDate] = useState(booking.date);
  const [rawTime, setRawTime] = useState(booking.time);
  const { slotState, load: loadSlots } = useSlotLoader(
    (d, p) => getMyEditSlots({ bookingId: booking.id, date: d, party: p }),
    { date: booking.date, party: booking.party },
  );

  const [state, action, pending] = useActionState<MyEditState, FormData>(async (prev, formData) => {
    const result = await updateMyBooking(prev, formData);
    if (result.expired) onExpired();
    else if (result.done) onSaved(result.done);
    else loadSlots(date, party);
    return result;
  }, {});

  const time = slotState.slots.includes(rawTime) ? rawTime : "";
  const complete = Boolean(party && date && time) && !slotState.loading;
  const errors = state.fieldErrors ?? {};
  const aria = (name: string) => ({
    "aria-invalid": errors[name] ? (true as const) : undefined,
    "aria-describedby": errors[name] ? `edit-${name}-error` : undefined,
  });

  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      aria-labelledby="edit-title"
      className="flex min-w-0 flex-col gap-5 rounded-card border border-rimlay-border bg-white p-5 shadow-soft sm:p-6"
    >
      <input type="hidden" name="bookingId" value={booking.id} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={time} />
      <input type="hidden" name="party" value={party ?? ""} />

      <div>
        <h2 id="edit-title" className="text-xl">
          แก้ไขคิว {formatThaiDate(booking.date)}
        </h2>
        <p className="mt-1 text-sm text-rimlay-driftwood">เปลี่ยนวัน เวลา หรือจำนวนที่นั่ง ระบบจะตรวจที่ว่างให้ใหม่</p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">จำนวนที่นั่ง</legend>
        <SeatPicker
          value={party}
          onChange={(n) => {
            setParty(n);
            loadSlots(date, n);
          }}
        />
        {errors.party ? <p className="text-sm text-rose-700">{errors.party}</p> : null}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">วันที่</legend>
        <MonthCalendar
          calendar={calendar}
          date={date}
          initialMonth={booking.date.slice(0, 7)}
          onSelect={(d) => {
            setDate(d);
            loadSlots(d, party);
          }}
        />
        {errors.date ? <p className="text-sm text-rose-700">{errors.date}</p> : null}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">
          เวลา {party ? <span className="font-normal text-rimlay-driftwood">(ว่างสำหรับ {party} ท่าน)</span> : null}
        </legend>
        <SlotGrid
          party={party}
          date={date}
          slotState={slotState}
          time={time}
          onSelect={setRawTime}
          onRetry={() => loadSlots(date, party)}
        />
        {errors.time ? <p className="text-sm text-rose-700">{errors.time}</p> : null}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="edit-name" label="ชื่อผู้จอง *" error={errors.name}>
          <input id="edit-name" name="name" autoComplete="name" defaultValue={state.values?.name ?? booking.name} className={inputClass} {...aria("name")} />
        </Field>
        <Field id="edit-email" label="อีเมล *" error={errors.email}>
          <input id="edit-email" name="email" type="email" autoComplete="email" defaultValue={state.values?.email ?? booking.email} className={inputClass} {...aria("email")} />
        </Field>
        <div className="sm:col-span-2">
          <Field
            id="edit-phone"
            label="เบอร์โทรศัพท์"
            hint="เบอร์โทรศัพท์แก้ไขไม่ได้ หากต้องการเปลี่ยน กรุณายกเลิกแล้วจองใหม่"
          >
            <input id="edit-phone" value={formatPhone(phone)} disabled readOnly className={inputClass} />
          </Field>
        </div>
        <p className="text-[13px] text-rimlay-driftwood sm:col-span-2">
          หากเปลี่ยนอีเมล คิวนี้จะผูกกับอีเมลใหม่ และไม่แสดงในรายการนี้อีก ต้องขอ OTP ใหม่เพื่อดูคิวจากอีเมลใหม่
        </p>
      </div>

      <FormError message={state.error} />
      <div className="flex flex-wrap justify-end gap-3 border-t border-rimlay-border pt-5">
        <button type="button" onClick={onClose} disabled={pending} className={secondaryButton}>
          ยกเลิกการแก้ไข
        </button>
        <button type="submit" disabled={!complete || pending} className={`${primaryButton} h-12`}>
          {pending ? "กำลังบันทึก…" : "บันทึกการเปลี่ยนแปลง"}
        </button>
      </div>
    </form>
  );
}
