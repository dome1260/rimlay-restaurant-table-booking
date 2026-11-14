"use client";

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:cursor-wait disabled:opacity-60 ${
        checked ? "justify-end bg-rimlay-blue" : "justify-start bg-rimlay-border"
      }`}
    >
      <span className="size-6 rounded-full bg-white shadow" />
    </button>
  );
}
