"use client";

import { useActionState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/backoffice/Toast";
import { login, type LoginState } from "./actions";

const inputClass =
  "h-11 w-full rounded-field border border-rimlay-border bg-white px-3 text-[15px] text-rimlay-deep placeholder:text-rimlay-driftwood/70 focus:border-rimlay-blue focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-rimlay-blue aria-invalid:border-rose-500";

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  const notice = params.get("notice");
  const toast = useToast();

  // One-off notice carried over a redirect (e.g. after deleting your own account).
  // The ref also stops React Strict Mode (dev) from showing it twice.
  const noticeShown = useRef(false);
  useEffect(() => {
    if (notice !== "account-deleted" || noticeShown.current) return;
    noticeShown.current = true;
    toast.success("ลบบัญชีของคุณแล้ว");
    window.history.replaceState(null, "", window.location.pathname);
  }, [notice, toast]);

  const [state, formAction, pending] = useActionState<LoginState, FormData>(async (prev, formData) => {
    const result = await login(prev, formData);
    // login() redirects on success, so only failures reach here.
    if (result.error) toast.error(result.error);
    else if (result.fieldErrors) toast.warning("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
    return result;
  }, {});

  return (
    <form action={formAction} noValidate className="flex w-full max-w-sm flex-col gap-5">
      <div>
        <h2 className="text-2xl text-rimlay-deep">เข้าสู่ระบบ</h2>
        <p className="mt-1 text-[15px] text-rimlay-driftwood">เมนูที่เห็นจะแสดงตามสิทธิ์ (Staff / Admin)</p>
      </div>

      <input type="hidden" name="next" value={next} />

      {state.error ? (
        <p role="alert" className="rounded-field border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="username" className="text-sm font-medium">
          ชื่อผู้ใช้
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state.username ?? ""}
          key={state.username ?? ""}
          aria-invalid={Boolean(state.fieldErrors?.username) || undefined}
          aria-describedby={state.fieldErrors?.username ? "username-error" : undefined}
          className={inputClass}
        />
        {state.fieldErrors?.username ? (
          <span id="username-error" className="text-sm text-rose-700">
            {state.fieldErrors.username}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          รหัสผ่าน
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(state.fieldErrors?.password) || undefined}
          aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
          className={inputClass}
        />
        {state.fieldErrors?.password ? (
          <span id="password-error" className="text-sm text-rose-700">
            {state.fieldErrors.password}
          </span>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-full bg-rimlay-blue text-base font-semibold text-white shadow-soft transition-colors hover:bg-rimlay-blue-hover disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </button>

      <p className="text-center text-[13px] text-rimlay-driftwood">ลืมรหัสผ่าน? ติดต่อ Admin ของร้าน</p>
    </form>
  );
}
