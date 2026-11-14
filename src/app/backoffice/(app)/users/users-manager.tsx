"use client";

import { useActionState, useState } from "react";
import { ConfirmDialog } from "@/components/backoffice/ConfirmDialog";
import { Modal } from "@/components/backoffice/Modal";
import { reportResult, useToast } from "@/components/backoffice/Toast";
import {
  dangerSmallButton,
  Field,
  FormError,
  inputClass,
  PageHeader,
  primaryButton,
  RolePill,
  secondaryButton,
  smallButton,
} from "@/components/backoffice/ui";
import { submittedValues, type ActionState } from "@/lib/action-state";
import type { AppRole } from "@/lib/auth/roles";
import { canDeleteFromList } from "@/lib/users/rules";
import { createUser, deleteUser, updateUser } from "./actions";

type User = { id: string; username: string; displayName: string; email: string; role: AppRole };

type DialogState = { mode: "create" } | { mode: "edit"; user: User } | { mode: "delete"; user: User } | null;

export function UsersManager({ users, meId }: { users: User[]; meId: string }) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const toast = useToast();
  const close = () => setDialog(null);

  return (
    <>
      <PageHeader
        title="ผู้ใช้งาน"
        description="พนักงานที่เข้าระบบหลังบ้านได้"
        action={
          <button type="button" className={primaryButton} onClick={() => setDialog({ mode: "create" })}>
            + เพิ่มผู้ใช้
          </button>
        }
      />

      <div className="overflow-x-auto rounded-card bg-white shadow-soft">
        <table className="w-full min-w-[720px] border-collapse text-[15px]">
          <thead>
            <tr className="border-b border-rimlay-border text-left text-[13px] text-rimlay-driftwood">
              <th scope="col" className="px-5 py-3 font-semibold">ชื่อ</th>
              <th scope="col" className="px-5 py-3 font-semibold">ชื่อผู้ใช้</th>
              <th scope="col" className="px-5 py-3 font-semibold">อีเมล</th>
              <th scope="col" className="px-5 py-3 font-semibold">สิทธิ์</th>
              <th scope="col" className="px-5 py-3 text-right font-semibold">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isMe = user.id === meId;
              const deletable = canDeleteFromList({ id: meId, role: "admin" }, user);
              return (
                <tr key={user.id} className="border-b border-rimlay-border/60 last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-full bg-rimlay-shallow font-semibold text-rimlay-blue">
                        {user.displayName.charAt(0).toUpperCase()}
                      </span>
                      <span className="font-semibold">{user.displayName}</span>
                      {isMe ? (
                        <span className="rounded-md bg-rimlay-shallow px-2 py-0.5 text-xs font-semibold text-rimlay-blue">คุณ</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-5 py-3">{user.username}</td>
                  <td className="break-all px-5 py-3 text-rimlay-driftwood">{user.email}</td>
                  <td className="px-5 py-3"><RolePill role={user.role} /></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className={smallButton}
                        aria-label={`แก้ไขผู้ใช้ ${user.username}`}
                        onClick={() => setDialog({ mode: "edit", user })}
                      >
                        แก้ไข
                      </button>
                      <button
                        type="button"
                        className={dangerSmallButton}
                        disabled={!deletable}
                        title={deletable ? undefined : "ลบบัญชีตัวเองได้ที่หน้าโปรไฟล์"}
                        aria-label={`ลบผู้ใช้ ${user.username}`}
                        onClick={() => setDialog({ mode: "delete", user })}
                      >
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[13px] text-rimlay-driftwood">
        ลบบัญชีของตัวเองไม่ได้จากหน้านี้ — ทำได้ที่หน้า “โปรไฟล์” เท่านั้น และจะถูกออกจากระบบทันที
      </p>

      <Modal
        open={dialog?.mode === "create" || dialog?.mode === "edit"}
        onClose={close}
        title={dialog?.mode === "edit" ? `แก้ไขผู้ใช้ ${dialog.user.username}` : "เพิ่มผู้ใช้"}
        description={
          dialog?.mode === "edit"
            ? "เว้นรหัสผ่านว่างไว้ถ้าไม่ต้องการเปลี่ยน"
            : "ตั้งรหัสผ่านเริ่มต้นแล้วแจ้งพนักงานด้วยตัวเอง"
        }
      >
        {dialog?.mode === "create" || dialog?.mode === "edit" ? (
          <UserForm user={dialog.mode === "edit" ? dialog.user : undefined} onDone={close} />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={dialog?.mode === "delete"}
        onClose={close}
        title={dialog?.mode === "delete" ? `ลบผู้ใช้ ${dialog.user.username}?` : ""}
        description="บัญชีนี้จะเข้าสู่ระบบไม่ได้อีก (ชื่อผู้ใช้เดิมนำกลับมาใช้ไม่ได้)"
        confirmLabel="ลบผู้ใช้"
        onConfirm={async () => {
          if (dialog?.mode !== "delete") return;
          const result = await deleteUser(dialog.user.id);
          reportResult(toast, result, `ลบผู้ใช้ ${dialog.user.username} แล้ว`);
          return result;
        }}
      />
    </>
  );
}

function UserForm({ user, onDone }: { user?: User; onDone: () => void }) {
  const toast = useToast();
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, formData) => {
    const result = user ? await updateUser(user.id, prev, formData) : await createUser(prev, formData);
    const username = user?.username ?? String(formData.get("username") ?? "").trim().toLowerCase();
    reportResult(toast, result, user ? `บันทึกผู้ใช้ ${username} แล้ว` : `เพิ่มผู้ใช้ ${username} แล้ว`);
    if (result.ok) onDone();
    return { ...result, values: submittedValues(formData) };
  }, {});
  const errors = state.fieldErrors ?? {};
  const aria = (name: string) => ({
    "aria-invalid": errors[name] ? (true as const) : undefined,
    "aria-describedby": errors[name] ? `user-${name}-error` : undefined,
  });

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormError message={state.error} />
      <Field id="user-username" label="ชื่อผู้ใช้" error={errors.username} hint={user ? "เปลี่ยนชื่อผู้ใช้ไม่ได้" : "a-z 0-9 . _ - ความยาว 3–30 ตัว"}>
        <input
          id="user-username"
          name="username"
          defaultValue={state.values?.username ?? user?.username ?? ""}
          readOnly={Boolean(user)}
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          className={inputClass}
          {...aria("username")}
        />
      </Field>
      <Field id="user-displayName" label="ชื่อที่แสดง" error={errors.displayName}>
        <input id="user-displayName" name="displayName" defaultValue={state.values?.displayName ?? user?.displayName ?? ""} autoComplete="off" className={inputClass} {...aria("displayName")} />
      </Field>
      <Field id="user-email" label="อีเมล" error={errors.email}>
        <input id="user-email" name="email" type="email" defaultValue={state.values?.email ?? user?.email ?? ""} autoComplete="off" className={inputClass} {...aria("email")} />
      </Field>
      <Field id="user-role" label="สิทธิ์" error={errors.role}>
        <select id="user-role" name="role" defaultValue={state.values?.role ?? user?.role ?? "staff"} className={inputClass} {...aria("role")}>
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
      </Field>
      <Field id="user-password" label={user ? "รหัสผ่านใหม่ (ไม่บังคับ)" : "รหัสผ่านเริ่มต้น"} error={errors.password} hint="อย่างน้อย 8 ตัวอักษร">
        <input id="user-password" name="password" type="password" autoComplete="new-password" className={inputClass} {...aria("password")} />
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
