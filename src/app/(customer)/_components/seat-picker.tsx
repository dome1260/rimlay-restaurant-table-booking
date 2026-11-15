"use client";

const SEATS = [1, 2, 3, 4, 5, 6, 7, 8];

export function SeatPicker({ value, onChange }: { value: number | null; onChange: (party: number) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
      {SEATS.map((n) => (
        <button
          key={n}
          type="button"
          aria-pressed={value === n}
          onClick={() => onChange(n)}
          className={`h-11 rounded-field border text-base font-semibold transition-colors ${
            value === n
              ? "border-rimlay-blue bg-rimlay-blue text-white"
              : "border-rimlay-border bg-white text-rimlay-deep hover:bg-rimlay-shallow"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
