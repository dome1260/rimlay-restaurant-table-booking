"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/backoffice/ConfirmDialog";
import { reportResult, useToast } from "@/components/backoffice/Toast";
import { primaryButton } from "@/components/backoffice/ui";
import { assignTables } from "./actions";

export type AssignTable = {
  id: string;
  name: string;
  seats: number;
  // Name of the seated booking using this table, if any (OQ-14).
  busyBy?: string;
};

export function AssignPanel({
  bookingId,
  party,
  tables,
  initialNote,
}: {
  bookingId: string;
  party: number;
  tables: AssignTable[];
  initialNote: string;
}) {
  const toast = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState(initialNote);
  const [warn, setWarn] = useState(false);
  const seats = tables.filter((t) => selected.includes(t.id)).reduce((sum, t) => sum + t.seats, 0);
  const enough = seats >= party;

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  async function submit() {
    const result = await assignTables(bookingId, selected, note);
    reportResult(toast, result, "จัดโต๊ะเรียบร้อยแล้ว");
    return result;
  }

  return (
    <section id="assign" aria-labelledby="assign-title" className="flex scroll-mt-6 flex-col gap-5 rounded-card bg-white p-6 shadow-soft">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="assign-title" className="text-lg">จัดโต๊ะ</h2>
          <p className="mt-1 text-sm text-rimlay-driftwood">
            ลูกค้า {party} ท่าน · เลือกได้มากกว่า 1 โต๊ะหากโต๊ะเดียวไม่พอ
          </p>
        </div>
        <div
          className={`rounded-field px-3 py-1.5 text-sm font-semibold ${
            selected.length === 0 ? "bg-rimlay-shallow text-rimlay-driftwood" : enough ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
          }`}
          data-testid="seat-counter"
        >
          เลือกแล้ว {seats} / {party} ที่นั่ง
        </div>
      </div>

      {tables.length === 0 ? (
        <p className="text-rimlay-driftwood">ยังไม่มีโต๊ะที่เปิดใช้งาน</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2.5">
          {tables.map((t) => {
            const busy = Boolean(t.busyBy);
            const on = selected.includes(t.id);
            return (
              <li key={t.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={busy}
                  onClick={() => toggle(t.id)}
                  className={`flex min-h-[5.5rem] w-full flex-col items-start justify-center gap-0.5 rounded-field border px-3.5 py-2.5 text-left ${
                    busy
                      ? "cursor-not-allowed border-amber-200 bg-amber-50 text-amber-900"
                      : on
                        ? "border-2 border-rimlay-blue bg-rimlay-blue text-white"
                        : "border-rimlay-border bg-white text-rimlay-deep hover:bg-rimlay-shallow"
                  }`}
                >
                  <span className="text-[17px] font-bold">{t.name}</span>
                  <span className="text-[13px]">{t.seats} ที่นั่ง</span>
                  {busy ? <span className="text-xs font-semibold">มีลูกค้า · {t.busyBy}</span> : null}
                  {on ? <span className="text-xs font-semibold">เลือกแล้ว</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="assign-note" className="text-sm font-medium">หมายเหตุ</label>
        <textarea
          id="assign-note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          className="w-full rounded-field border border-rimlay-border bg-white px-3 py-2.5 text-[15px] focus:border-rimlay-blue focus:outline-none"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          className={primaryButton}
          disabled={selected.length === 0}
          onClick={() => setWarn(true)}
        >
          ยืนยันการจัดโต๊ะ
        </button>
      </div>

      <ConfirmDialog
        open={warn}
        onClose={() => setWarn(false)}
        tone={enough ? "primary" : "danger"}
        title={enough ? "ยืนยันการจัดโต๊ะ?" : "ที่นั่งไม่พอสำหรับลูกค้า"}
        description={
          enough
            ? `จัดโต๊ะ ${tables.filter((t) => selected.includes(t.id)).map((t) => t.name).join(" + ")} ให้ลูกค้า ${party} ท่าน`
            : `ที่นั่งรวม ${seats} น้อยกว่าจำนวนลูกค้า ${party} ท่าน ต้องการยืนยันการจัดโต๊ะต่อหรือไม่`
        }
        confirmLabel={enough ? "ยืนยัน" : "ยืนยันต่อ"}
        onConfirm={submit}
      />
    </section>
  );
}
