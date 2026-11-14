"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { fieldErrorsFrom, success, type ActionState } from "@/lib/action-state";
import { loadSlotOptions, type SlotOptions } from "@/lib/booking/availability";
import { rpcErrorMessage } from "@/lib/booking/errors";
import { isValidDate } from "@/lib/booking/format";
import { CHANNEL_LABEL, ACTIVE_STATUSES, type BookingChannel, type BookingStatus } from "@/lib/booking/status";
import { createBookingSchema, editBookingSchema } from "@/lib/booking/schema";
import { getNow } from "@/lib/clock";
import { after } from "next/server";
import { sendBookingEmail } from "@/lib/email/send";
import { trimSeconds } from "@/lib/store/quota";
import { createAdminClient } from "@/lib/supabase/admin";

// Every write goes through a database RPC (see the bookings migration) called with the secret
// key after requireRole: the quota / phone / cutoff rules are re-checked under a lock there.

function refresh() {
  revalidatePath("/backoffice/bookings", "layout");
}

function failure(error: { message?: string }): ActionState {
  const message = rpcErrorMessage(error);
  if (message) return { error: message, severity: "warning" };
  console.error("booking action failed", error);
  return { error: "ดำเนินการไม่สำเร็จ กรุณาลองใหม่" };
}

async function duplicatePhoneFailure(phone: string, date: string): Promise<ActionState> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("bookings")
    .select("id, customer_name, start_time, channel")
    .eq("phone", phone)
    .eq("booking_date", date)
    .in("status", ACTIVE_STATUSES)
    .maybeSingle();
  if (!data) return { error: rpcErrorMessage({ message: "phone_daily_limit" })!, severity: "warning" };
  return {
    error: `เบอร์นี้มีคิววันที่เลือกแล้ว (${trimSeconds(data.start_time)} · ${data.customer_name} · ${
      CHANNEL_LABEL[data.channel]
    }) — 1 เบอร์จองได้ 1 คิวต่อวัน`,
    severity: "warning",
    link: { href: `/backoffice/bookings/${data.id}`, label: "ดูคิวเดิม" },
  };
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function createBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole("staff");
  const parsed = createBookingSchema.safeParse({
    channel: text(formData, "channel"),
    date: text(formData, "date"),
    time: text(formData, "time"),
    party: text(formData, "party"),
    name: text(formData, "name"),
    phone: text(formData, "phone"),
    email: text(formData, "email").trim(),
    note: text(formData, "note"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };
  const input = parsed.data;

  const admin = createAdminClient();
  const { data: id, error } = await admin.rpc("create_booking", {
    p_channel: input.channel,
    p_date: input.date,
    p_start: input.time,
    p_party: input.party,
    p_name: input.name,
    p_phone: input.phone,
    p_email: input.email,
    p_note: input.note,
    p_actor: profile.id,
    p_actor_name: profile.displayName,
    p_now: (await getNow()).toISOString(),
  });
  if (error) {
    if (error.message === "phone_daily_limit") return duplicatePhoneFailure(input.phone, input.date);
    return failure(error);
  }

  after(() => sendBookingEmail(id, "created"));
  refresh();
  return success();
}

export async function updateBooking(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole("staff");
  const parsed = editBookingSchema.safeParse({
    date: text(formData, "date"),
    time: text(formData, "time"),
    party: text(formData, "party"),
    name: text(formData, "name"),
    email: text(formData, "email").trim(),
    note: text(formData, "note"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };
  const input = parsed.data;

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("bookings")
    .select("phone, booking_date, start_time, party_size, customer_name, email, note")
    .eq("id", id)
    .maybeSingle();
  if (!before) return failure({ message: "not_found" });

  const { error } = await admin.rpc("update_booking", {
    p_id: id,
    p_date: input.date,
    p_start: input.time,
    p_party: input.party,
    p_name: input.name,
    p_email: input.email,
    p_note: input.note,
    p_actor: profile.id,
    p_actor_name: profile.displayName,
    p_now: (await getNow()).toISOString(),
    // Staff edits are not bound by the 15 minute rule (STF-08).
    p_enforce_cutoff: false,
  });
  if (error) {
    if (error.message === "phone_daily_limit") return duplicatePhoneFailure(before.phone, input.date);
    return failure(error);
  }

  const changed =
    before.booking_date !== input.date ||
    trimSeconds(before.start_time) !== input.time ||
    before.party_size !== input.party ||
    before.customer_name !== input.name ||
    (before.email ?? "") !== input.email ||
    (before.note ?? "") !== input.note;
  if (changed) after(() => sendBookingEmail(id, "edited"));

  refresh();
  return success();
}

async function changeStatus(id: string, to: BookingStatus): Promise<ActionState> {
  const profile = await requireRole("staff");
  const { error } = await createAdminClient().rpc("change_booking_status", {
    p_id: id,
    p_to: to,
    p_actor: profile.id,
    p_actor_name: profile.displayName,
    p_now: (await getNow()).toISOString(),
  });
  if (error) return failure(error);
  refresh();
  return success();
}

export async function markArrived(id: string): Promise<ActionState> {
  return changeStatus(id, "arrived");
}

export async function closeTable(id: string): Promise<ActionState> {
  return changeStatus(id, "closed");
}

export async function cancelBooking(id: string): Promise<ActionState> {
  const result = await changeStatus(id, "cancelled");
  if (result.ok) after(() => sendBookingEmail(id, "cancelled"));
  return result;
}

export async function assignTables(id: string, tableIds: string[], note: string): Promise<ActionState> {
  const profile = await requireRole("staff");
  const { error } = await createAdminClient().rpc("assign_tables", {
    p_id: id,
    p_table_ids: tableIds,
    p_note: note.trim().slice(0, 300),
    p_actor: profile.id,
    p_actor_name: profile.displayName,
    p_now: (await getNow()).toISOString(),
  });
  if (error) return failure(error);
  refresh();
  return success();
}

export async function getSlotOptions(input: {
  date: string;
  party: number;
  channel?: BookingChannel;
  excludeId?: string;
}): Promise<SlotOptions> {
  await requireRole("staff");
  if (!isValidDate(input.date) || !(input.party >= 1 && input.party <= 8)) {
    return { slots: [], reason: "กรุณาเลือกวันที่และจำนวนที่นั่ง" };
  }
  return loadSlotOptions({ ...input, now: await getNow() });
}
