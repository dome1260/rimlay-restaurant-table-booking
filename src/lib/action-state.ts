// Shared result shape for form Server Actions used with useActionState.
export type ActionState = {
  ok?: boolean;
  error?: string;
  // "warning" = expected refusal by a business rule (e.g. last Admin); otherwise errors are failures.
  severity?: "warning";
  fieldErrors?: Record<string, string | undefined>;
  // Bumped on every success so the client can reset forms / close dialogs.
  nonce?: number;
  // Echo of what was typed so a failed submit doesn't wipe the form (React 19 resets
  // uncontrolled forms after every action). Never includes passwords.
  values?: Record<string, string>;
};

export function submittedValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.toLowerCase().includes("password")) out[key] = value;
  }
  return out;
}

export function fieldErrorsFrom(error: { issues: { path: PropertyKey[]; message: string }[] }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export function success(): ActionState {
  return { ok: true, nonce: Date.now() };
}
