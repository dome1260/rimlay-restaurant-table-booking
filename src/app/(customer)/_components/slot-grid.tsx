"use client";

import { useEffect, useRef, useState } from "react";
import { smallButton } from "@/components/backoffice/ui";
import type { SlotOptions } from "@/lib/booking/availability";

export type SlotState = { slots: string[]; reason?: string; loading: boolean; failed?: boolean };

// Loads the free slots for a date + party size. Only the latest request may update the state, so
// a slow answer for an earlier choice never overwrites a newer one.
// `initial` loads once on mount (editing an existing booking starts with its own date and party).
export function useSlotLoader(
  fetcher: (date: string, party: number) => Promise<SlotOptions>,
  initial?: { date: string; party: number },
) {
  const [slotState, setSlotState] = useState<SlotState>({ slots: [], loading: Boolean(initial) });
  const request = useRef(0);

  function run(date: string, party: number) {
    const id = ++request.current;
    fetcher(date, party)
      .then((res) => {
        if (id === request.current) setSlotState({ slots: res.slots, reason: res.reason, loading: false });
      })
      .catch(() => {
        if (id === request.current) {
          setSlotState({ slots: [], reason: "โหลดเวลาที่ว่างไม่สำเร็จ กรุณาลองใหม่", loading: false, failed: true });
        }
      });
  }

  function load(date: string, party: number | null) {
    if (!date || !party) return;
    setSlotState((s) => ({ ...s, loading: true }));
    run(date, party);
  }

  useEffect(() => {
    if (initial) run(initial.date, initial.party);
    // Mount only: later changes go through load().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { slotState, load };
}

export function SlotGrid({
  party,
  date,
  slotState,
  time,
  onSelect,
  onRetry,
}: {
  party: number | null;
  date: string;
  slotState: SlotState;
  time: string;
  onSelect: (slot: string) => void;
  onRetry: () => void;
}) {
  return (
    <div aria-live="polite">
      {!party || !date ? (
        <p className="text-[15px] text-rimlay-driftwood">เลือกจำนวนที่นั่งและวันที่เพื่อดูเวลาที่ว่าง</p>
      ) : slotState.loading && slotState.slots.length === 0 ? (
        <p className="text-[15px] text-rimlay-driftwood">กำลังโหลดเวลาที่ว่าง…</p>
      ) : slotState.slots.length === 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-field bg-rimlay-shell px-3 py-2 text-[15px] text-rimlay-driftwood">
          <span>{slotState.reason ?? "ไม่มีเวลาว่าง"}</span>
          {slotState.failed ? (
            <button type="button" onClick={onRetry} className={smallButton}>
              ลองใหม่
            </button>
          ) : null}
        </div>
      ) : (
        <div className={`grid grid-cols-4 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(96px,1fr))] ${slotState.loading ? "opacity-60" : ""}`}>
          {slotState.slots.map((slot) => (
            <button
              key={slot}
              type="button"
              aria-pressed={time === slot}
              onClick={() => onSelect(slot)}
              className={`h-11 rounded-field border text-[15px] font-medium transition-colors ${
                time === slot
                  ? "border-rimlay-blue bg-rimlay-blue text-white"
                  : "border-rimlay-border bg-white text-rimlay-deep hover:bg-rimlay-shallow"
              }`}
            >
              {slot}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
