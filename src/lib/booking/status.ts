export type BookingStatus = "waiting" | "arrived" | "seated" | "closed" | "system_closed" | "cancelled";
export type BookingChannel = "web" | "walk_in" | "phone_in";
export type BookingAction = "edit" | "cancel" | "arrive" | "assign" | "close";

export const STATUS_LABEL: Record<BookingStatus, string> = {
  waiting: "รอมาถึง",
  arrived: "ลูกค้ามาถึงแล้ว",
  seated: "จัดโต๊ะแล้ว",
  closed: "ปิดโต๊ะ",
  system_closed: "ปิดโต๊ะโดยระบบ",
  cancelled: "ยกเลิก",
};

export const STATUS_STYLE: Record<BookingStatus, string> = {
  waiting: "bg-amber-100 text-amber-800",
  arrived: "bg-sky-100 text-sky-800",
  seated: "bg-emerald-100 text-emerald-800",
  closed: "bg-stone-100 text-stone-700",
  system_closed: "bg-slate-200 text-slate-700",
  cancelled: "bg-rose-100 text-rose-800",
};

export const STATUS_DOT: Record<BookingStatus, string> = {
  waiting: "bg-amber-500",
  arrived: "bg-sky-500",
  seated: "bg-emerald-500",
  closed: "bg-stone-500",
  system_closed: "bg-slate-500",
  cancelled: "bg-rose-500",
};

export const CHANNEL_LABEL: Record<BookingChannel, string> = {
  web: "Web app",
  walk_in: "Walk-in",
  phone_in: "Phone-in",
};

// Statuses that still hold seats and count towards the one-phone-per-day rule (System Rule 4, 8).
export const ACTIVE_STATUSES: BookingStatus[] = ["waiting", "arrived", "seated"];

export function isFinal(status: BookingStatus): boolean {
  return !ACTIVE_STATUSES.includes(status);
}

// Buttons shown on the detail page (ADM-05). Edit and cancel exist only while waiting: once the
// customer has arrived the booking can only move forward. Final bookings are read-only.
export function allowedActions(status: BookingStatus): BookingAction[] {
  switch (status) {
    case "waiting":
      return ["arrive", "edit", "cancel"];
    case "arrived":
      return ["assign"];
    case "seated":
      return ["close"];
    default:
      return [];
  }
}

// The single "next step" button on the list.
export function nextAction(status: BookingStatus): Extract<BookingAction, "arrive" | "assign" | "close"> | null {
  if (status === "waiting") return "arrive";
  if (status === "arrived") return "assign";
  if (status === "seated") return "close";
  return null;
}

export const ACTION_LABEL: Record<BookingAction, string> = {
  edit: "แก้ไข",
  cancel: "ยกเลิกคิว",
  arrive: "ลูกค้ามาถึงแล้ว",
  assign: "จัดโต๊ะ",
  close: "ปิดโต๊ะ",
};
