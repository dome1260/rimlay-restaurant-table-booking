import { z } from "zod";

// Same pattern as the profiles_username_format check constraint.
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;
export const MIN_PASSWORD_LENGTH = 8;

const base = {
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(USERNAME_PATTERN, "ชื่อผู้ใช้ 3–30 ตัว ใช้ a-z 0-9 . _ - เท่านั้น"),
  displayName: z.string().trim().min(1, "กรุณากรอกชื่อที่แสดง").max(50, "ชื่อยาวไม่เกิน 50 ตัวอักษร"),
  email: z.string().trim().toLowerCase().pipe(z.email("อีเมลไม่ถูกต้อง")),
  role: z.enum(["staff", "admin"], { error: "กรุณาเลือกสิทธิ์" }),
};

const password = z.string().min(MIN_PASSWORD_LENGTH, `รหัสผ่านอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`);

export const createUserSchema = z.object({ ...base, password });

// Username is the login handle and never changes after creation; an empty password
// means "keep the current one".
export const updateUserSchema = z.object({
  displayName: base.displayName,
  email: base.email,
  role: base.role,
  password: z.union([z.literal(""), password]).optional(),
});
