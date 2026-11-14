import { STATUS_LABEL, STATUS_STYLE, type BookingStatus } from "@/lib/booking/status";

export function StatusPill({ status }: { status: BookingStatus }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-semibold ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
