"use client";

import { useTransition, type FormEvent } from "react";
import { useToast } from "@/components/backoffice/Toast";
import { resetSimulatedTime, setSimulatedTime } from "./dev-clock-actions";

// Development-only control (the layout doesn't render it in production). Moving the clock lets
// the cutoff / no-show cases be tested without waiting in real time.
export function DevClock({ nowLocal, simulated }: { nowLocal: string; simulated: boolean }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function run(task: () => Promise<{ error?: string }>, done: string) {
    startTransition(async () => {
      const result = await task();
      if (result.error) toast.error(result.error);
      else toast.success(done);
    });
  }

  // Read the value from the form at submit time rather than from React state, so the
  // datetime field works the same however it was filled in.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const local = String(new FormData(event.currentTarget).get("local") ?? "");
    if (local) run(() => setSimulatedTime(local), "ตั้งเวลาจำลองแล้ว");
  }

  return (
    <form
      onSubmit={submit}
      className={`mb-6 flex flex-wrap items-center gap-3 rounded-field border border-dashed px-4 py-2.5 text-sm ${
        simulated ? "border-amber-400 bg-amber-50 text-amber-900" : "border-rimlay-border bg-white text-rimlay-driftwood"
      }`}
    >
      <span className="font-semibold">{simulated ? "เวลาจำลอง (dev)" : "เวลาจริง (dev)"}</span>
      <span className="tabular-nums" data-testid="dev-now">{nowLocal.replace("T", " ")}</span>
      <label className="sr-only" htmlFor="dev-clock-input">ตั้งเวลาจำลอง</label>
      <input
        id="dev-clock-input"
        key={nowLocal}
        type="datetime-local"
        name="local"
        defaultValue={nowLocal}
        className="h-9 rounded-field border border-rimlay-border bg-white px-2 text-sm text-rimlay-deep"
      />
      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-field bg-rimlay-deep px-3 font-semibold text-white disabled:opacity-60"
      >
        ตั้งเวลา
      </button>
      {simulated ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(resetSimulatedTime, "กลับไปใช้เวลาจริงแล้ว")}
          className="h-9 rounded-field border border-amber-400 bg-white px-3 font-semibold disabled:opacity-60"
        >
          รีเซ็ต
        </button>
      ) : null}
    </form>
  );
}
