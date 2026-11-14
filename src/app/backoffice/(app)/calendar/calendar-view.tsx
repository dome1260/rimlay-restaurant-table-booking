"use client";

import Link from "next/link";
import { useState } from "react";
import { Modal } from "@/components/backoffice/Modal";
import { CALENDAR_VISIBLE_ITEMS, type CalCell, type CalItem } from "@/lib/booking/calendar";
import { formatThaiDate } from "@/lib/booking/format";
import { CHANNEL_LABEL, STATUS_DOT, STATUS_LABEL } from "@/lib/booking/status";
import { StatusPill } from "../bookings/status-pill";

const WEEKDAYS_FULL = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const WEEKDAYS_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const CLOSED_LABEL = { closed: "ร้านปิด", holiday: "วันหยุดพิเศษ" } as const;

function summary(cell: CalCell): string {
  return `${cell.items.length} รายการ · ${cell.seats} ที่นั่ง`;
}

export function CalendarView({ cells, today }: { cells: CalCell[]; today: string }) {
  const [moreDate, setMoreDate] = useState<string | null>(null);
  const firstOfMonth = cells.find((c) => c.inMonth)?.date ?? today;
  const [selected, setSelected] = useState(cells.some((c) => c.date === today && c.inMonth) ? today : firstOfMonth);
  const moreCell = cells.find((c) => c.date === moreDate);
  const selectedCell = cells.find((c) => c.date === selected);

  return (
    <>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-rimlay-driftwood" aria-label="สีสถานะ">
        {(Object.keys(STATUS_DOT) as (keyof typeof STATUS_DOT)[]).map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
            {STATUS_LABEL[status]}
          </li>
        ))}
      </ul>

      {/* Desktop / tablet: month grid */}
      <div className="hidden overflow-x-auto rounded-card bg-white shadow-soft md:block">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-7 border-b border-rimlay-border text-[13px] font-semibold text-rimlay-driftwood">
            {WEEKDAYS_FULL.map((d) => (
              <span key={d} className="px-3 py-2.5">{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7" data-testid="calendar-grid">
            {cells.map((cell) => {
              const visible = cell.items.slice(0, CALENDAR_VISIBLE_ITEMS);
              const more = cell.items.length - visible.length;
              return (
                <div
                  key={cell.date}
                  data-date={cell.date}
                  className={`flex min-h-36 min-w-0 flex-col gap-1 border-b border-r border-rimlay-border/50 p-2 ${
                    cell.closed === "holiday" ? "bg-rose-50" : !cell.inMonth || cell.closed ? "bg-rimlay-shell" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex size-7 items-center justify-center rounded-full text-[14px] font-semibold ${
                        cell.isToday ? "bg-rimlay-blue text-white" : cell.inMonth ? "" : "text-rimlay-driftwood/60"
                      }`}
                    >
                      {cell.day}
                    </span>
                    {cell.closed ? <span className="text-[11px] font-semibold text-rose-700">{CLOSED_LABEL[cell.closed]}</span> : null}
                  </div>
                  {visible.map((item) => (
                    <BookingChip key={item.id} item={item} />
                  ))}
                  {more > 0 ? (
                    <button
                      type="button"
                      onClick={() => setMoreDate(cell.date)}
                      className="self-start rounded-field px-1.5 py-0.5 text-[12px] font-semibold text-rimlay-blue hover:bg-rimlay-shallow"
                    >
                      + เพิ่มเติม {more}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Phone: compact month + the selected day's list */}
      <div className="flex flex-col gap-4 md:hidden">
        <section className="rounded-card bg-white p-3 shadow-soft" aria-label="เลือกวัน">
          <div className="mb-1 grid grid-cols-7 text-center text-[12px] text-rimlay-driftwood">
            {WEEKDAYS_SHORT.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((cell) => {
              const on = cell.date === selected;
              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => setSelected(cell.date)}
                  aria-label={`${formatThaiDate(cell.date)}${cell.closed ? ` ${CLOSED_LABEL[cell.closed]}` : ""}${cell.items.length ? ` ${cell.items.length} รายการ` : ""}`}
                  aria-pressed={on}
                  className={`flex h-11 flex-col items-center justify-center gap-0.5 rounded-field text-[14px] ${
                    on
                      ? "bg-rimlay-blue font-bold text-white"
                      : cell.isToday
                        ? "bg-rimlay-shallow font-bold text-rimlay-blue"
                        : cell.closed
                          ? "text-rimlay-driftwood/60 line-through"
                          : cell.inMonth
                            ? ""
                            : "text-rimlay-driftwood/50"
                  }`}
                >
                  {cell.day}
                  <span className={`size-1.5 rounded-full ${cell.items.length ? (on ? "bg-white" : "bg-amber-500") : "bg-transparent"}`} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </section>
        {selectedCell ? (
          <section className="flex flex-col gap-2" aria-label="คิวของวันที่เลือก">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[17px]">{formatThaiDate(selectedCell.date)}</h2>
              <span className="text-[13px] text-rimlay-driftwood">{summary(selectedCell)}</span>
            </div>
            {selectedCell.closed ? <p className="text-[14px] font-semibold text-rose-700">{CLOSED_LABEL[selectedCell.closed]}</p> : null}
            {selectedCell.items.length === 0 && !selectedCell.closed ? (
              <p className="text-rimlay-driftwood">ยังไม่มีคิวในวันนี้</p>
            ) : null}
            {selectedCell.items.map((item) => (
              <BookingRow key={item.id} item={item} className="rounded-card bg-white shadow-soft" />
            ))}
          </section>
        ) : null}
      </div>

      <Modal
        open={moreCell !== undefined}
        onClose={() => setMoreDate(null)}
        title={moreCell ? formatThaiDate(moreCell.date) : ""}
        description={moreCell ? summary(moreCell) : undefined}
      >
        <ul className="flex max-h-96 flex-col overflow-y-auto">
          {moreCell?.items.map((item) => (
            <li key={item.id}>
              <BookingRow item={item} onNavigate={() => setMoreDate(null)} />
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}

function BookingChip({ item }: { item: CalItem }) {
  return (
    <Link
      href={`/backoffice/bookings/${item.id}`}
      className="flex min-w-0 items-center gap-1.5 rounded-md bg-rimlay-shell px-1.5 py-1 text-[12px] hover:bg-rimlay-shallow"
    >
      <span className={`size-2 shrink-0 rounded-full ${STATUS_DOT[item.status]}`} aria-hidden="true" />
      <span className="min-w-0 truncate">
        {item.time} {item.name} · {item.party}
      </span>
    </Link>
  );
}

function BookingRow({ item, className = "", onNavigate }: { item: CalItem; className?: string; onNavigate?: () => void }) {
  return (
    <Link
      href={`/backoffice/bookings/${item.id}`}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-field px-3 py-2.5 hover:bg-rimlay-shell ${className}`}
    >
      <span className="w-12 font-bold tabular-nums">{item.time}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{item.name}</span>
        <span className="text-[13px] text-rimlay-driftwood">
          {item.party} ท่าน · {CHANNEL_LABEL[item.channel]}
        </span>
      </span>
      <StatusPill status={item.status} />
    </Link>
  );
}
