"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/backoffice/ConfirmDialog";
import { reportResult, useToast } from "@/components/backoffice/Toast";
import { dangerButton } from "@/components/backoffice/ui";
import { LAST_ADMIN_MESSAGE } from "@/lib/users/rules";
import { deleteOwnAccount } from "./actions";

export function DeleteAccount({ lastAdmin }: { lastAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();

  return (
    <section aria-labelledby="danger-heading" className="rounded-card border border-rose-200 bg-white p-6">
      <h2 id="danger-heading" className="text-lg text-rose-700">ลบบัญชีของฉัน</h2>
      <p className="mt-1 text-[15px] text-rimlay-driftwood">
        เมื่อลบแล้วจะถูกออกจากระบบทันทีและเข้าสู่ระบบด้วยบัญชีนี้ไม่ได้อีก
      </p>
      {lastAdmin ? (
        <p role="note" className="mt-3 rounded-field bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          {LAST_ADMIN_MESSAGE}
        </p>
      ) : null}
      <button type="button" className={`${dangerButton} mt-4`} disabled={lastAdmin} onClick={() => setOpen(true)}>
        ลบบัญชีของฉัน
      </button>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="ลบบัญชีของคุณ?"
        description="การลบนี้ย้อนกลับด้วยตัวเองไม่ได้ ต้องให้ Admin คนอื่นสร้างบัญชีให้ใหม่"
        confirmLabel="ลบบัญชี"
        onConfirm={async () => {
          // On success the action redirects to login (the login page shows the success toast).
          const result = await deleteOwnAccount();
          reportResult(toast, result, "ลบบัญชีแล้ว");
          return result;
        }}
      />
    </section>
  );
}
