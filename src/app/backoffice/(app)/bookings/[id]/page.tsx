import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/dal";
import { addMonths, formatEventTime, formatThaiDate } from "@/lib/booking/format";
import { describeChanges, eventActor, eventTitle, type BookingEvent } from "@/lib/booking/history";
import { formatPhone } from "@/lib/booking/phone";
import { bangkokNow } from "@/lib/booking/slots";
import { CHANNEL_LABEL } from "@/lib/booking/status";
import { getNow } from "@/lib/clock";
import { trimSeconds } from "@/lib/store/quota";
import { createClient } from "@/lib/supabase/server";
import { AssignPanel } from "../assign-panel";
import { DetailActions } from "../booking-controls";
import { StatusPill } from "../status-pill";

export const metadata: Metadata = { title: "รายละเอียดการจอง" };

export default function BookingDetailPage(props: PageProps<"/backoffice/bookings/[id]">) {
  return (
    <Suspense fallback={<p className="text-rimlay-driftwood">กำลังโหลดรายละเอียดการจอง…</p>}>
      <DetailContent params={props.params} />
    </Suspense>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function DetailContent({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("staff");
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("*, booking_tables(table_id, dining_tables(id, name, seats))")
    .eq("id", id)
    .maybeSingle();
  if (!booking) notFound();

  const [{ data: events }, now] = await Promise.all([
    supabase.from("booking_events").select("*").eq("booking_id", id).order("id", { ascending: false }),
    getNow(),
  ]);
  const today = bangkokNow(now).date;
  const time = trimSeconds(booking.start_time);

  // Tables to offer when seating: active ones, marking those a different seated booking still uses (OQ-14).
  let assignTables: { id: string; name: string; seats: number; busyBy?: string }[] = [];
  if (booking.status === "arrived") {
    const [{ data: tables }, { data: busy }] = await Promise.all([
      supabase.from("dining_tables").select("id, name, seats").eq("is_active", true),
      supabase.from("booking_tables").select("table_id, bookings!inner(id, customer_name, status)").eq("bookings.status", "seated"),
    ]);
    const busyBy = new Map((busy ?? []).map((row) => [row.table_id, row.bookings.customer_name]));
    assignTables = (tables ?? [])
      .map((t) => ({ ...t, busyBy: busyBy.get(t.id) }))
      .sort((a, b) => a.name.localeCompare(b.name, "th", { numeric: true }));
  }

  const seated = booking.booking_tables
    .map((r) => r.dining_tables)
    .filter((t): t is { id: string; name: string; seats: number } => Boolean(t))
    .sort((a, b) => a.name.localeCompare(b.name, "th", { numeric: true }));

  const info: [string, string][] = [
    ["วันที่", formatThaiDate(booking.booking_date)],
    ["เวลา", `${time} น.`],
    ["ที่นั่ง", `${booking.party_size} ท่าน`],
    ["เบอร์โทร", formatPhone(booking.phone)],
    ["อีเมล", booking.email ?? "ไม่มี"],
    ["ช่องทาง", CHANNEL_LABEL[booking.channel]],
    ["โต๊ะ", seated.length ? seated.map((t) => `${t.name} (${t.seats})`).join(" + ") : "ยังไม่จัดโต๊ะ"],
    ["หมายเหตุ", booking.note ?? "ไม่มี"],
  ];

  const history = (events ?? []) as BookingEvent[];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <nav aria-label="breadcrumb" className="flex gap-1.5 text-sm text-rimlay-driftwood">
          <Link href={`/backoffice/bookings?date=${booking.booking_date}`} className="hover:underline">
            รายการจอง
          </Link>
          <span aria-hidden="true">/</span>
          <span>#{booking.code}</span>
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl">{booking.customer_name}</h1>
            <StatusPill status={booking.status} />
            <span className="rounded-md border border-rimlay-border px-2 py-0.5 text-[13px]">{CHANNEL_LABEL[booking.channel]}</span>
          </div>
          <DetailActions
            status={booking.status}
            label={`#${booking.code}`}
            today={today}
            maxDate={addMonths(today, 1)}
            booking={{
              id: booking.id,
              date: booking.booking_date,
              time,
              party: booking.party_size,
              name: booking.customer_name,
              phone: booking.phone,
              email: booking.email ?? "",
              note: booking.note ?? "",
              channel: booking.channel,
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        {booking.status === "arrived" ? (
          <div className="min-w-0 flex-[999_1_32rem]">
            <AssignPanel
              bookingId={booking.id}
              party={booking.party_size}
              tables={assignTables}
              initialNote={booking.note ?? ""}
            />
          </div>
        ) : null}

        <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-5">
          <section className="rounded-card bg-white p-6 shadow-soft" aria-labelledby="info-title">
            <h2 id="info-title" className="mb-3 text-base">ข้อมูลการจอง</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[15px]">
              {info.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-rimlay-driftwood">{label}</dt>
                  <dd className="break-words font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-card bg-white p-6 shadow-soft" aria-labelledby="history-title">
            <h2 id="history-title" className="mb-3 text-base">ประวัติสถานะ</h2>
            <ol className="flex flex-col">
              {history.map((event, index) => (
                <li key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="mt-1.5 size-3 shrink-0 rounded-full bg-rimlay-blue" />
                    {index < history.length - 1 ? <span className="my-1 w-0.5 flex-1 bg-rimlay-border" /> : null}
                  </div>
                  <div className="pb-4">
                    <div className="font-semibold">{eventTitle(event)}</div>
                    {describeChanges(event.details).map((line) => (
                      <div key={line} className="text-sm">{line}</div>
                    ))}
                    <div className="text-[13px] text-rimlay-driftwood">
                      {formatEventTime(event.created_at)} · {eventActor(event, booking.channel)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
