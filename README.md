# Rimlay – Restaurant Table Booking

ระบบจองโต๊ะร้าน Rimlay: หน้าลูกค้าจองโต๊ะ (ไม่ต้อง login) และระบบหลังบ้านสำหรับ Staff / Admin

Next.js 16 + Tailwind 4 + Supabase (cloud) — deploy เป้าหมายคือ Vercel

## สถานะ
- เสร็จ: หลังบ้านทั้งหมด (login, ตั้งค่าร้าน, ผู้ใช้, รายการจอง, จัดโต๊ะ, Calendar, Dashboard, งานตั้งเวลา no-show / ปิดร้าน, อีเมลแจ้งลูกค้า)
- ยังไม่ทำ: ฝั่งลูกค้า (Phase 4–5) และ deploy (Phase 6)
- รายละเอียดแต่ละ Phase: ดู [CLAUDE.md](CLAUDE.md)

## เริ่มใช้งาน
```bash
npm install
cp .env.example .env.local   # ใส่ค่าตาม .env.example
npm run dev                  # http://localhost:3000
```

| คำสั่ง | ใช้ทำอะไร |
|---|---|
| `npm test` | unit test (Vitest) |
| `npm run lint` / `npm run typecheck` | ตรวจโค้ด |
| `npm run seed` | สร้างบัญชีทดสอบ admin01, staff01 |
| `npm run seed:store` | ใส่โต๊ะและเวลาทำการตัวอย่าง |

## เอกสารอ้างอิง
- Feature Spec / Test Case: Google Sheet "Restaurant Table Booking – Feature Spec"
- User journey: Miro board `uXjVEQakB8s=`
- Layout: Claude Design "Restaurant Table Booking – Layout"
