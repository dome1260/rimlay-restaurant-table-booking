import { z } from "zod";
import { isValidDate } from "./format";
import { normalizePhone, PHONE_PATTERN } from "./phone";

const date = z.string().refine(isValidDate, "กรุณาเลือกวันที่");
const time = z.string().regex(/^\d{2}:\d{2}$/, "กรุณาเลือกเวลา");
const party = z.coerce
  .number({ error: "กรุณาเลือกจำนวนที่นั่ง" })
  .int("จำนวนที่นั่งต้องเป็นจำนวนเต็ม")
  .min(1, "เลือกได้ 1–8 ที่นั่ง")
  .max(8, "เลือกได้ 1–8 ที่นั่ง");
const name = z.string().trim().min(1, "กรุณากรอกชื่อลูกค้า").max(100, "ชื่อยาวไม่เกิน 100 ตัวอักษร");
// Optional for walk-in / phone-in (CUS-12: no email means no notification).
const email = z.union([z.literal(""), z.email("รูปแบบอีเมลไม่ถูกต้อง")]);
const note = z.string().trim().max(300, "หมายเหตุยาวไม่เกิน 300 ตัวอักษร");

const phone = z
  .string()
  .transform(normalizePhone)
  .pipe(
    z
      .string()
      .min(1, "กรุณากรอกเบอร์โทรศัพท์")
      .regex(PHONE_PATTERN, "เบอร์โทรศัพท์ต้องเป็นมือถือไทย 10 หลัก ขึ้นต้น 06 / 08 / 09"),
  );

export const createBookingSchema = z.object({
  channel: z.enum(["walk_in", "phone_in"], { error: "กรุณาเลือกช่องทาง" }),
  date,
  time,
  party,
  name,
  phone,
  email,
  note,
});

// CUS-05: the public page needs all three contact fields (the email receives the OTP and notices).
export const webBookingSchema = z.object({
  date,
  time,
  party,
  name,
  phone,
  email: z.string().trim().min(1, "กรุณากรอกอีเมล").pipe(z.email("รูปแบบอีเมลไม่ถูกต้อง")),
});

// CUS-10: customers edit everything but the phone number; the email stays required because it
// is what they sign in with.
export const myBookingEditSchema = webBookingSchema.omit({ phone: true });

// The phone number and the channel are fixed once a booking exists.
export const editBookingSchema = z.object({ date, time, party, name, email, note });

export type MyBookingEditInput = z.infer<typeof myBookingEditSchema>;
export type WebBookingInput = z.infer<typeof webBookingSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type EditBookingInput = z.infer<typeof editBookingSchema>;
