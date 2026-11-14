import { z } from "zod";
import { EDD_MINUTES, SLOT_MINUTES, toMinutes } from "./quota";

export const tableSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อโต๊ะ").max(20, "ชื่อโต๊ะยาวไม่เกิน 20 ตัวอักษร"),
  seats: z.coerce
    .number({ error: "กรุณากรอกจำนวนที่นั่ง" })
    .int("จำนวนที่นั่งต้องเป็นจำนวนเต็ม")
    .min(1, "อย่างน้อย 1 ที่นั่ง")
    .max(20, "ไม่เกิน 20 ที่นั่ง"),
});

const timeString = z.string().regex(/^\d{2}:\d{2}$/, "รูปแบบเวลาไม่ถูกต้อง");

const dayHoursSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    isOpen: z.boolean(),
    open: z.string(),
    close: z.string(),
  })
  .superRefine((day, ctx) => {
    if (!day.isOpen) return;
    const open = timeString.safeParse(day.open);
    const close = timeString.safeParse(day.close);
    if (!open.success) ctx.addIssue({ code: "custom", path: ["open"], message: "กรุณาเลือกเวลาเปิด" });
    if (!close.success) ctx.addIssue({ code: "custom", path: ["close"], message: "กรุณาเลือกเวลาปิด" });
    if (!open.success || !close.success) return;

    // Slots run every 30 minutes from the opening time, so times must sit on :00 / :30.
    if (toMinutes(day.open) % SLOT_MINUTES !== 0)
      ctx.addIssue({ code: "custom", path: ["open"], message: "เวลาเปิดต้องลงท้าย :00 หรือ :30" });
    if (toMinutes(day.close) % SLOT_MINUTES !== 0)
      ctx.addIssue({ code: "custom", path: ["close"], message: "เวลาปิดต้องลงท้าย :00 หรือ :30" });
    if (toMinutes(day.close) - toMinutes(day.open) < EDD_MINUTES)
      ctx.addIssue({
        code: "custom",
        path: ["close"],
        message: "เวลาปิดต้องห่างจากเวลาเปิดอย่างน้อย 2 ชั่วโมง",
      });
  });

export const businessHoursSchema = z
  .array(dayHoursSchema)
  .length(7, "ต้องมีข้อมูลครบ 7 วัน")
  .refine((days) => new Set(days.map((d) => d.weekday)).size === 7, "วันในสัปดาห์ซ้ำกัน");

export type DayHoursInput = z.infer<typeof dayHoursSchema>;

// Today's date in Asia/Bangkok as YYYY-MM-DD (the whole system runs on Bangkok time).
export function bangkokToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);
}

export const holidaySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "กรุณาเลือกวันที่")
    .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)), "วันที่ไม่ถูกต้อง"),
  note: z.string().trim().max(100, "หมายเหตุยาวไม่เกิน 100 ตัวอักษร").optional(),
});

export function isPastDate(date: string, now: Date = new Date()): boolean {
  return date < bangkokToday(now);
}
