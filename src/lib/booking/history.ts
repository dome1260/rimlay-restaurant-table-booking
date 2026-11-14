import { formatThaiDate } from "./format";
import { CHANNEL_LABEL, STATUS_LABEL, type BookingChannel, type BookingStatus } from "./status";

export type BookingEvent = {
  id: number;
  kind: string;
  from_status: BookingStatus | null;
  to_status: BookingStatus | null;
  details: unknown;
  actor_name: string | null;
  actor_kind: string;
  created_at: string;
};

type Change = { from: unknown; to: unknown };

const FIELD_LABEL: Record<string, string> = {
  booking_date: "วันที่",
  start_time: "เวลา",
  party_size: "ที่นั่ง",
  customer_name: "ชื่อ",
  email: "อีเมล",
  note: "หมายเหตุ",
};

function show(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "ไม่มี";
  if (field === "booking_date") return formatThaiDate(String(value));
  if (field === "party_size") return `${value} ท่าน`;
  return String(value);
}

export function describeChanges(details: unknown): string[] {
  if (!details || typeof details !== "object") return [];
  return Object.entries(details as Record<string, Change>)
    .filter(([field]) => field in FIELD_LABEL)
    .map(([field, change]) => `${FIELD_LABEL[field]}: ${show(field, change.from)} → ${show(field, change.to)}`);
}

export function eventTitle(event: BookingEvent): string {
  if (event.kind === "created") return "รอมาถึง (จองสำเร็จ)";
  if (event.kind === "edited") return "แก้ไขคิว";
  const tables = (event.details as { tables?: string } | null)?.tables;
  const label = event.to_status ? STATUS_LABEL[event.to_status] : "";
  return tables ? `${label} · ${tables}` : label;
}

export function eventActor(event: BookingEvent, channel: BookingChannel): string {
  if (event.actor_kind === "customer") return `โดยลูกค้า (${CHANNEL_LABEL[channel]})`;
  if (event.actor_kind === "system") return "โดยระบบ";
  return event.actor_name ? `โดย ${event.actor_name}` : "โดยพนักงาน";
}
