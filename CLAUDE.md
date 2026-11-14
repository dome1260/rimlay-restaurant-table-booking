@AGENTS.md

# Rimlay – Restaurant Table Booking

ระบบจองโต๊ะร้าน Rimlay แบบ full-stack: หน้าลูกค้าจองโต๊ะ (ไม่ต้อง login) + ระบบหลังบ้าน Staff / Admin

## Sources of truth
- **Feature Spec / Test Case**: Google Sheet "Restaurant Table Booking – Feature Spec"
  `1B5y0rEyopLBP-skREK-ArsgDo6VzCHhWvFCYwuTSOxg` — tabs: Feature Spec (0), Booking Status (1), System Rules (2), Open Questions (3), Task List (4), Test Case (5)
- **User journey**: Miro board https://miro.com/app/board/uXjVEQakB8s=/
- **UX/UI layout**: Claude Design "Restaurant Table Booking – Layout" https://claude.ai/artifact/KdhWwfQjHnz5kuP4mTxcEC
  (ใช้ layout ตามนี้ แต่สี/ฟอนต์/โลโก้ตาม brand book Rimlay — ดู `src/app/globals.css`)
- ห้ามเดา requirement หรือผลการทดสอบ — ถ้าไม่ชัดให้ถามคุณโดม

## Agent workflow (ทำทุก Phase)
1. เข้า **plan mode** วางแผน Phase นั้น แล้วรอคุณโดมรีวิวว่าผ่านก่อนจึงลงมือ
2. เขียนโค้ด แล้วทำ **unit test ให้ผ่านทั้งหมด** พร้อม `npm run lint`, `npm run typecheck`, `next build` ไม่มี error
3. **เปิด browser ทดสอบจริง** แล้วบันทึกผลที่ได้จริงลงแท็บ Test Case ในชีต
   (ผลที่ได้จริง / สถานะ / ผู้ทดสอบ / วันที่ / หมายเหตุ) — เคสที่หน้าปลายทางยังไม่มีให้ใส่ Blocked พร้อมเหตุผล
4. **สรุปผล** ให้คุณโดม แล้ว**ขออนุญาตก่อน commit / push ทุกครั้ง**

## Phases
ลำดับ: ทำหลังบ้าน (Admin + Staff) ให้เสร็จก่อน แล้วจึงทำฝั่งลูกค้า (ปรับแผน 2026-11-14)

| Phase | ขอบเขต | Feature | สถานะ |
|---|---|---|---|
| 0 | Login หลังบ้าน + หน้าหลัก 1 หน้า, profiles + RLS, brand + โลโก้ | BO-01 | เสร็จ |
| 1 | หลังบ้าน ส่วนที่ 1 — ตั้งค่าร้าน + ผู้ใช้: โต๊ะ, เวลาทำการ, วันหยุดพิเศษ, จัดการผู้ใช้, ลบบัญชีตัวเอง | ADM-01, 02, 03, 06, 07 | |
| 2 | หลังบ้าน ส่วนที่ 2 — งานจองคิว: schema การจอง, logic slot/quota/EDD, งาน Staff ทั้งหมด, รายละเอียดการจอง, Calendar, เตือนคิวที่กระทบ, email (Gmail SMTP + Nodemailer), เวลาจำลอง dev | SYS-01, 02, 05, STF-01–08, ADM-04, 05, 08 | |
| 3 | Scheduled jobs (no-show, ปิดสถานะตอนร้านปิด — pg_cron + pg_net) + Dashboard | SYS-03, 04, ADM-09, 10, 11 | |
| 4 | ลูกค้าจองโต๊ะ (C1–C6) ใช้ logic/email จาก Phase 2, เอา redirect `/` ชั่วคราวออก | CUS-01–06, 12 | |
| 5 | ลูกค้าจัดการคิวเอง: OTP, ล็อกเบอร์, แก้ไข/ยกเลิก | CUS-07–11 | |
| 6 | E2E ทั้งระบบ + deploy Vercel | — | |

## Stack & constraints
- Next.js 16 (App Router, Cache Components เปิดอยู่, `src/proxy.ts` แทน middleware) + Tailwind 4 + TypeScript
  — อ่าน `node_modules/next/dist/docs/` ก่อนเขียนโค้ด Next ทุกครั้ง; ส่วนที่อ่าน session/cookies ต้องอยู่ใน `<Suspense>`
- Supabase บน cloud (project `rimlay-booking`, ap-southeast-1) — **ไม่ใช้ Supabase local**
  - apply migration ผ่าน Supabase MCP **และ**เก็บไฟล์ไว้ใน `supabase/migrations/` เสมอ
  - หลัง migration ให้ regenerate `src/lib/supabase/database.types.ts` และรัน security advisors
- Key ทั้งหมดอยู่ใน `.env.local` เท่านั้น ห้าม commit; `SUPABASE_SECRET_KEY` คุณโดมใส่เอง ห้ามขอในแชท
- Back-office login = username + email จริง (ค้นหา email ฝั่ง server ด้วย secret key)
- เวลาทั้งระบบใช้ Asia/Bangkok; เคสที่ต้องรอเวลาใช้ "เวลาจำลอง" เฉพาะ dev และระบุในผลทดสอบ
- Vercel = เป้าหมาย deploy (ยังไม่เชื่อมจนถึง Phase 6)

## Commands
- `npm run dev` — dev server http://localhost:3000
- `npm test` — Vitest unit tests (`src/**/*.test.ts`)
- `npm run lint` / `npm run typecheck` / `npx next build`
- `npm run seed` — สร้าง/อัปเดตบัญชีทดสอบ admin01, staff01 (อ่านค่าจาก `.env.local`, รันซ้ำได้)

## Conventions

### Addressing each other
- เรียกผู้ใช้ว่า "คุณโดม" หรือ "คุณ D" — ห้ามใช้ "พี่"
- ผู้ใช้เรียก assistant ว่า "Athena" หรือ "A"

### Code comments
1. **Business logic** — อธิบาย WHY ที่ไม่ชัดเจน (constraint, invariant, workaround) ไม่ใช่ WHAT
2. **งานที่ยังไม่เสร็จ** — mockup, stub, รอ integration (API/key ที่ยังไม่มี, TODO รอ backend) ให้ comment ชัดเจนว่ายังไม่เสร็จและรออะไร
3. **ไม่ใส่ comment อธิบายเกินจำเป็น** — นอกจากข้อ 1 และ 2 ไม่ต้องใส่

### Git
- Subject สั้น (imperative, บอกว่าเปลี่ยนอะไร) + สรุป 2–4 บรรทัด — รายละเอียดยาวไปไว้ใน PR/MR description
- ห้ามใส่ trailer `Co-Authored-By: Claude ...`
- ห้ามรัน `git commit` โดยไม่ได้รับอนุญาตจากคุณโดม (stage ได้)
- ไม่ใช้ GitHub CLI; remote คือ https://github.com/dome1260/rimlay-restaurant-table-booking
- คำสั่งที่ต้องยืนยันตัวตนกับ GitHub ให้เปิด terminal ของโปรเจกต์แล้วบอกคำสั่ง คุณโดมกรอก username + PAT เอง — ห้ามขอหรือเก็บ token ในแชทหรือไฟล์
