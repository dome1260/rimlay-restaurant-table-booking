"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { reportResult, useToast } from "@/components/backoffice/Toast";
import { Field, FormError, inputClass, primaryButton, secondaryButton } from "@/components/backoffice/ui";
import type { ActionState } from "@/lib/action-state";
import type { SlotOptions } from "@/lib/booking/availability";
import { CHANNEL_LABEL } from "@/lib/booking/status";
import { createBooking, getSlotOptions, updateBooking } from "./actions";

export type EditableBooking = {
  id: string;
  date: string;
  time: string;
  party: number;
  name: string;
  phone: string;
  email: string;
  note: string;
  channel: "web" | "walk_in" | "phone_in";
};

type Props = {
  today: string;
  maxDate: string;
  booking?: EditableBooking;
  onDone: () => void;
};

export function BookingForm({ today, maxDate, booking, onDone }: Props) {
  const toast = useToast();
  const editing = Boolean(booking);
  const [channel, setChannel] = useState<"walk_in" | "phone_in">(
    booking && booking.channel !== "web" ? booking.channel : "walk_in",
  );
  const [date, setDate] = useState(booking?.date ?? today);
  const [party, setParty] = useState(booking?.party ?? 2);
  const [time, setTime] = useState(booking?.time ?? "");
  // Slot answers are keyed by the inputs that produced them, so a stale answer never shows
  // while a newer one is loading.
  const [answer, setAnswer] = useState<{ key: string; options: SlotOptions } | null>(null);
  const key = `${date}|${party}|${channel}`;
  const latest = useRef(key);

  useEffect(() => {
    latest.current = key;
    if (!date) return;
    getSlotOptions({ date, party, channel: editing ? undefined : channel, excludeId: booking?.id })
      .then((options) => {
        if (latest.current !== key) return;
        setAnswer({ key, options });
        setTime((current) => {
          if (current && options.slots.includes(current)) return current;
          return !editing && channel === "walk_in" && options.defaultSlot ? options.defaultSlot : "";
        });
      })
      .catch(() => {
        if (latest.current === key) setAnswer({ key, options: { slots: [], reason: "โหลดช่วงเวลาไม่สำเร็จ กรุณาลองใหม่" } });
      });
  }, [key, date, party, channel, editing, booking?.id]);

  const loading = answer?.key !== key;
  const options = loading ? null : answer.options;

  // A manual submit instead of <form action>: React 19 resets the form after every action, which
  // snaps the controlled party <select> back to its first option when the save is refused.
  const [state, setState] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = booking ? await updateBooking(booking.id, {}, formData) : await createBooking({}, formData);
      const name = String(formData.get("name") ?? "").trim();
      reportResult(toast, result, booking ? "บันทึกการแก้ไขคิวแล้ว" : `สร้างคิวของ ${name} แล้ว`);
      if (result.ok) onDone();
      else setState(result);
    });
  }

  const err = state.fieldErrors ?? {};

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormError message={state.error} />
      {state.link ? (
        <Link href={state.link.href} className="-mt-2 text-sm font-semibold text-rimlay-blue underline">
          {state.link.label}
        </Link>
      ) : null}

      <input type="hidden" name="channel" value={channel} />
      <input type="hidden" name="time" value={time} />

      {editing ? (
        <p className="rounded-field bg-rimlay-shallow px-3 py-2 text-sm text-rimlay-deep">
          ช่องทาง {CHANNEL_LABEL[booking!.channel]} · แก้ไขเบอร์โทรศัพท์ไม่ได้
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">ช่องทาง</span>
          <div role="radiogroup" aria-label="ช่องทาง" className="grid grid-cols-2 gap-1 rounded-field bg-rimlay-shallow p-1">
            {(["walk_in", "phone_in"] as const).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={channel === c}
                onClick={() => setChannel(c)}
                className={`h-10 rounded-[10px] text-[15px] ${
                  channel === c ? "bg-white font-semibold shadow-soft" : "font-medium text-rimlay-driftwood"
                }`}
              >
                {CHANNEL_LABEL[c]}
              </button>
            ))}
          </div>
          <span className="text-[13px] text-rimlay-driftwood">
            Walk-in จองได้ทันทีโดยไม่ติดเงื่อนไขปิดรับจอง 15 นาที · Phone-in ปิดรับจอง 15 นาทีก่อนเริ่ม slot
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field id="bk-party" label="จำนวนที่นั่ง *" error={err.party}>
          <select
            id="bk-party"
            name="party"
            value={party}
            onChange={(e) => setParty(Number(e.target.value))}
            className={inputClass}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n} ท่าน
              </option>
            ))}
          </select>
        </Field>
        <Field id="bk-date" label="วันที่ *" error={err.date}>
          <input
            id="bk-date"
            name="date"
            type="date"
            min={today}
            max={maxDate}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-2" aria-live="polite">
        <span className="text-sm font-medium">
          เวลา * <span className="font-normal text-rimlay-driftwood">(ที่ว่างสำหรับ {party} ท่าน)</span>
        </span>
        {loading ? (
          <p className="text-sm text-rimlay-driftwood">กำลังโหลดช่วงเวลา…</p>
        ) : options && options.slots.length > 0 ? (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5" role="group" aria-label="เวลา">
            {options.slots.map((slot) => (
              <button
                key={slot}
                type="button"
                aria-pressed={time === slot}
                onClick={() => setTime(slot)}
                className={`h-11 rounded-field border text-[15px] font-semibold tabular-nums ${
                  time === slot
                    ? "border-rimlay-blue bg-rimlay-blue text-white"
                    : "border-rimlay-border bg-white text-rimlay-deep hover:bg-rimlay-shallow"
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-field bg-amber-50 px-3 py-2 text-sm text-amber-900">{options?.reason}</p>
        )}
        {err.time ? <span className="text-sm text-rose-700">{err.time}</span> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="bk-name" label="ชื่อลูกค้า *" error={err.name}>
          <input
            id="bk-name"
            name="name"
            defaultValue={booking?.name ?? ""}
            autoComplete="off"
            aria-invalid={Boolean(err.name) || undefined}
            className={inputClass}
          />
        </Field>
        <Field id="bk-phone" label="เบอร์โทรศัพท์ *" error={err.phone}>
          {editing ? (
            <input id="bk-phone" value={booking!.phone} readOnly disabled className={inputClass} />
          ) : (
            <input
              id="bk-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              defaultValue=""
              placeholder="081-234-5678"
              autoComplete="off"
              aria-invalid={Boolean(err.phone) || undefined}
              className={inputClass}
            />
          )}
        </Field>
      </div>

      <Field
        id="bk-email"
        label="อีเมล"
        error={err.email}
        hint="ไม่บังคับ · ใส่เพื่อให้ลูกค้าได้รับอีเมลแจ้งเตือน"
      >
        <input
          id="bk-email"
          name="email"
          type="email"
          defaultValue={booking?.email ?? ""}
          placeholder="name@email.com"
          autoComplete="off"
          aria-invalid={Boolean(err.email) || undefined}
          className={inputClass}
        />
      </Field>

      <Field id="bk-note" label="หมายเหตุ" error={err.note}>
        <textarea
          id="bk-note"
          name="note"
          rows={2}
          defaultValue={booking?.note ?? ""}
          placeholder="เช่น ขอที่นั่งริมหน้าต่าง"
          className="w-full rounded-field border border-rimlay-border bg-white px-3 py-2.5 text-[15px] focus:border-rimlay-blue focus:outline-none"
        />
      </Field>

      <div className="flex flex-wrap justify-end gap-3 pt-1">
        <button type="button" className={secondaryButton} onClick={onDone} disabled={pending}>
          ยกเลิก
        </button>
        <button type="submit" className={primaryButton} disabled={pending || !time}>
          {pending ? "กำลังบันทึก…" : editing ? "บันทึก" : "สร้างคิว"}
        </button>
      </div>
    </form>
  );
}
