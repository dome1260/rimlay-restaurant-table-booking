"use client";

import { useActionState, useState, useTransition } from "react";
import { Modal } from "@/components/backoffice/Modal";
import { Switch } from "@/components/backoffice/Switch";
import { reportResult, useToast } from "@/components/backoffice/Toast";
import {
  Field,
  FormError,
  inputClass,
  PageHeader,
  primaryButton,
  secondaryButton,
  smallButton,
} from "@/components/backoffice/ui";
import { submittedValues, type ActionState } from "@/lib/action-state";
import { createTable, setTableActive, updateTable } from "./actions";

type Table = { id: string; name: string; seats: number; is_active: boolean };

export function TablesManager({ tables, maxQuota }: { tables: Table[]; maxQuota: number }) {
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; table: Table } | null>(null);
  const [pendingId, setPendingId] = useState<string>();
  const [, startTransition] = useTransition();
  const toast = useToast();
  const activeCount = tables.filter((t) => t.is_active).length;

  function toggle(table: Table, next: boolean) {
    setPendingId(table.id);
    startTransition(async () => {
      const result = await setTableActive(table.id, next);
      reportResult(toast, result, `${next ? "เปิด" : "ปิด"}ใช้งานโต๊ะ ${table.name} แล้ว`);
      setPendingId(undefined);
    });
  }

  return (
    <>
      <PageHeader
        title="จัดการโต๊ะ"
        description="โต๊ะลบไม่ได้ ใช้ปิดใช้งานแทนเพื่อเก็บประวัติการจัดโต๊ะ"
        action={
          <button type="button" className={primaryButton} onClick={() => setDialog({ mode: "create" })}>
            + เพิ่มโต๊ะ
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-card bg-white p-5 shadow-soft">
          <div className="text-sm text-rimlay-driftwood">Max quota ต่อช่วงเวลา</div>
          <div className="text-3xl font-bold" data-testid="max-quota">
            {maxQuota} <span className="text-[15px] font-medium text-rimlay-driftwood">ที่นั่ง</span>
          </div>
        </div>
        <div className="rounded-card bg-white p-5 shadow-soft">
          <div className="text-sm text-rimlay-driftwood">โต๊ะที่เปิดใช้งาน</div>
          <div className="text-3xl font-bold">
            {activeCount} <span className="text-[15px] font-medium text-rimlay-driftwood">/ {tables.length} โต๊ะ</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-card bg-white shadow-soft">
        <table className="w-full min-w-[560px] border-collapse text-[15px]">
          <thead>
            <tr className="border-b border-rimlay-border text-left text-[13px] text-rimlay-driftwood">
              <th scope="col" className="px-5 py-3 font-semibold">ชื่อโต๊ะ</th>
              <th scope="col" className="px-5 py-3 font-semibold">จำนวนที่นั่ง</th>
              <th scope="col" className="px-5 py-3 font-semibold">สถานะ</th>
              <th scope="col" className="px-5 py-3 text-right font-semibold">แก้ไข</th>
            </tr>
          </thead>
          <tbody>
            {tables.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-rimlay-driftwood">
                  ยังไม่มีโต๊ะ กด “เพิ่มโต๊ะ” เพื่อเริ่มต้น
                </td>
              </tr>
            ) : null}
            {tables.map((table) => (
              <tr key={table.id} className="border-b border-rimlay-border/60 last:border-0">
                <td className="px-5 py-3 font-bold">{table.name}</td>
                <td className="px-5 py-3">{table.seats} ที่นั่ง</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={table.is_active}
                      label={`เปิดใช้งานโต๊ะ ${table.name}`}
                      disabled={pendingId === table.id}
                      onChange={(next) => toggle(table, next)}
                    />
                    <span className={table.is_active ? "font-semibold text-emerald-700" : "font-semibold text-rimlay-driftwood"}>
                      {table.is_active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    type="button"
                    className={smallButton}
                    aria-label={`แก้ไขโต๊ะ ${table.name}`}
                    onClick={() => setDialog({ mode: "edit", table })}
                  >
                    แก้ไข
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog?.mode === "edit" ? `แก้ไขโต๊ะ ${dialog.table.name}` : "เพิ่มโต๊ะ"}
      >
        {dialog ? (
          <TableForm
            table={dialog.mode === "edit" ? dialog.table : undefined}
            onDone={() => setDialog(null)}
          />
        ) : null}
      </Modal>
    </>
  );
}

function TableForm({ table, onDone }: { table?: Table; onDone: () => void }) {
  const toast = useToast();
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const result = table ? await updateTable(table.id, prev, formData) : await createTable(prev, formData);
    const name = String(formData.get("name") ?? "").trim();
    reportResult(toast, result, table ? `บันทึกโต๊ะ ${name} แล้ว` : `เพิ่มโต๊ะ ${name} แล้ว`);
    if (result.ok) onDone();
    return { ...result, values: submittedValues(formData) };
  }, {});

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormError message={state.error} />
      <Field id="table-name" label="ชื่อโต๊ะ" error={state.fieldErrors?.name}>
        <input
          id="table-name"
          name="name"
          defaultValue={state.values?.name ?? table?.name ?? ""}
          autoComplete="off"
          aria-invalid={Boolean(state.fieldErrors?.name) || undefined}
          aria-describedby={state.fieldErrors?.name ? "table-name-error" : undefined}
          className={inputClass}
        />
      </Field>
      <Field id="table-seats" label="จำนวนที่นั่ง" error={state.fieldErrors?.seats} hint="1–20 ที่นั่ง">
        <input
          id="table-seats"
          name="seats"
          type="number"
          inputMode="numeric"
          min={1}
          max={20}
          defaultValue={state.values?.seats ?? table?.seats ?? ""}
          aria-invalid={Boolean(state.fieldErrors?.seats) || undefined}
          aria-describedby={state.fieldErrors?.seats ? "table-seats-error" : undefined}
          className={inputClass}
        />
      </Field>
      <div className="flex flex-wrap justify-end gap-3 pt-1">
        <button type="button" className={secondaryButton} onClick={onDone} disabled={pending}>
          ยกเลิก
        </button>
        <button type="submit" className={primaryButton} disabled={pending}>
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </div>
    </form>
  );
}
