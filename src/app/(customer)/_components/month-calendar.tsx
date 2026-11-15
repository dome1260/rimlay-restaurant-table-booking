"use client";

import { useState } from "react";
import { formatMonthTitle, shiftMonth } from "@/lib/booking/calendar";
import { buildCustomerCells, type PublicCalendar } from "@/lib/booking/customer-calendar";
import { formatThaiDate } from "@/lib/booking/format";

const WEEKDAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

export function MonthCalendar({
  calendar,
  date,
  onSelect,
  initialMonth,
}: {
  calendar: PublicCalendar;
  date: string;
  onSelect: (date: string) => void;
  initialMonth?: string;
}) {
  const [month, setMonth] = useState(initialMonth ?? calendar.today.slice(0, 7));
  const lastMonth = calendar.maxDate.slice(0, 7);
  const cells = buildCustomerCells(month, calendar);

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="เดือนก่อนหน้า"
          disabled={month <= calendar.today.slice(0, 7)}
          onClick={() => setMonth(shiftMonth(month, -1))}
          className="flex size-11 items-center justify-center rounded-field border border-rimlay-border bg-white text-rimlay-deep hover:bg-rimlay-shallow disabled:cursor-not-allowed disabled:text-rimlay-driftwood/40 disabled:hover:bg-white"
        >
          <Chevron direction="left" />
        </button>
        <span className="font-semibold" aria-live="polite">
          {formatMonthTitle(month)}
        </span>
        <button
          type="button"
          aria-label="เดือนถัดไป"
          disabled={month >= lastMonth}
          onClick={() => setMonth(shiftMonth(month, 1))}
          className="flex size-11 items-center justify-center rounded-field border border-rimlay-border bg-white text-rimlay-deep hover:bg-rimlay-shallow disabled:cursor-not-allowed disabled:text-rimlay-driftwood/40 disabled:hover:bg-white"
        >
          <Chevron direction="right" />
        </button>
      </div>
      <div className="mb-1.5 grid grid-cols-7 gap-1 text-center text-[13px] text-rimlay-driftwood sm:gap-1.5">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {cells.map((cell) => {
          if (!cell.inMonth) return <span key={cell.date} aria-hidden="true" />;
          const selected = cell.date === date;
          const open = cell.state === "open";
          const tone = selected
            ? "border-rimlay-blue bg-rimlay-blue font-semibold text-white"
            : open
              ? `bg-white text-rimlay-deep hover:bg-rimlay-shallow ${cell.isToday ? "border-rimlay-blue font-semibold text-rimlay-blue" : "border-rimlay-border"}`
              : cell.state === "holiday"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : cell.state === "closed"
                  ? "border-transparent text-rimlay-driftwood line-through"
                  : "border-transparent text-rimlay-driftwood/50";
          return (
            <button
              key={cell.date}
              type="button"
              disabled={!open}
              aria-pressed={selected}
              aria-label={`${formatThaiDate(cell.date)}${cell.state === "holiday" ? " วันหยุดพิเศษ" : cell.state === "closed" ? " ร้านปิด" : ""}`}
              onClick={() => onSelect(cell.date)}
              className={`flex h-12 flex-col items-center justify-center rounded-field border text-[15px] leading-tight transition-colors disabled:cursor-not-allowed ${tone}`}
            >
              {cell.day}
              {cell.state === "holiday" ? <span className="text-[10px]">หยุด</span> : null}
              {cell.isToday && open && !selected ? <span className="text-[10px]">วันนี้</span> : null}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-rimlay-driftwood">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-rimlay-blue" /> วันที่เลือก
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded border border-rose-200 bg-rose-50" /> วันหยุดพิเศษ
        </span>
        <span className="flex items-center gap-1.5">
          <span className="line-through">16</span> ร้านปิด
        </span>
      </div>
    </>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );
}
