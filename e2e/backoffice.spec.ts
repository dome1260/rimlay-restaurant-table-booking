import { expect, test, type Page } from "@playwright/test";
import { addDays, formatThaiDate } from "../src/lib/booking/format";
import {
  cleanupTestData,
  createFixture,
  db,
  pickTestDate,
  restoreStore,
  snapshotStore,
  testPhone,
  TEST_NAME,
  type StoreSnapshot,
} from "./helpers/db";
import { loginBackoffice, pickDay, section, showMonth } from "./helpers/ui";

// TSK-057: back-office — role login, walk-in / phone-in, arrive → assign → close, edit rules,
// settings that change what customers can book.
test.describe.configure({ mode: "serial" });

let date: string;
let snapshot: StoreSnapshot;

test.beforeAll(async () => {
  await cleanupTestData();
  snapshot = await snapshotStore();
  date = await pickTestDate(8);
});

test.afterAll(async () => {
  await restoreStore(snapshot);
});

async function createInForm(page: Page, b: { channel: "Walk-in" | "Phone-in"; party: number; time: string; n: number }) {
  await page.goto(`/backoffice/bookings?date=${date}`);
  await page.getByRole("button", { name: "+ สร้างคิว" }).click();
  const dialog = page.getByRole("dialog", { name: "สร้างคิวใหม่" });
  await dialog.getByRole("radio", { name: b.channel }).click();
  await dialog.locator("#bk-party").selectOption(String(b.party));
  await dialog.locator("#bk-date").fill(date);
  await dialog.getByRole("group", { name: "เวลา" }).getByRole("button", { name: b.time, exact: true }).click();
  await dialog.locator("#bk-name").fill(`${TEST_NAME} ${b.n}`);
  await dialog.locator("#bk-phone").fill(testPhone(b.n));
  await dialog.getByRole("button", { name: "สร้างคิว" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("link", { name: `ดูรายละเอียด ${TEST_NAME} ${b.n}` })).toBeVisible();
}

test("staff sees only the front-desk menu (TC-046)", async ({ page }) => {
  await loginBackoffice(page, "staff01");
  const nav = page.getByRole("navigation").first();
  await expect(nav).toContainText("หน้าร้าน");
  await expect(nav).not.toContainText("ADMIN");
  await page.goto("/backoffice/bookings");
  await expect(page.getByRole("heading", { name: "รายการจอง" })).toBeVisible();
  await page.goto("/backoffice/users");
  await expect(page).not.toHaveURL(/\/users/);
});

test("creates walk-in and phone-in bookings, then arrive → assign two tables → close", async ({ page }) => {
  await loginBackoffice(page, "staff01");
  await createInForm(page, { channel: "Walk-in", party: 6, time: "18:00", n: 10 });
  await createInForm(page, { channel: "Phone-in", party: 2, time: "18:30", n: 11 });

  const { data } = await db.from("bookings").select("channel, party_size").in("phone", [testPhone(10), testPhone(11)]).order("phone");
  expect(data).toEqual([
    { channel: "walk_in", party_size: 6 },
    { channel: "phone_in", party_size: 2 },
  ]);

  await page.getByRole("link", { name: `ดูรายละเอียด ${TEST_NAME} 10` }).click();
  await expect(page).toHaveURL(/\/backoffice\/bookings\/[0-9a-f-]{36}/);
  await page.getByRole("button", { name: "ลูกค้ามาถึงแล้ว" }).click();
  await page.getByRole("button", { name: "ยืนยัน ลูกค้ามาถึงแล้ว" }).click();
  await expect(page.getByText("ลูกค้ามาถึงแล้ว").first()).toBeVisible();

  const assign = page.locator("#assign");
  await assign.getByRole("button", { name: /^T1/ }).click();
  await assign.getByRole("button", { name: /^T2/ }).click();
  await expect(page.getByTestId("seat-counter")).toHaveText("เลือกแล้ว 8 / 6 ที่นั่ง");
  await assign.getByRole("button", { name: "ยืนยันการจัดโต๊ะ" }).click();
  await page.getByRole("button", { name: "ยืนยัน", exact: true }).click();
  await expect(page.getByRole("button", { name: "ปิดโต๊ะ" })).toBeVisible();

  await page.getByRole("button", { name: "ปิดโต๊ะ" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "ปิดโต๊ะ" }).click();
  await expect.poll(async () => (await db.from("bookings").select("status").eq("phone", testPhone(10)).single()).data?.status).toBe("closed");
  const { count } = await db
    .from("booking_tables")
    .select("*", { count: "exact", head: true })
    .eq("booking_id", (await db.from("bookings").select("id").eq("phone", testPhone(10)).single()).data!.id);
  expect(count).toBe(2);
});

test("edit refuses a full slot and a day the phone already has (TC-072)", async ({ page }) => {
  // 20 active seats: 8 + 8 + 4 at 13:00 fill the 13:00–15:00 window.
  for (const [n, party] of [[20, 8], [21, 8], [22, 4]] as const) {
    expect((await createFixture(n, date, "13:00", party)).error).toBeNull();
  }
  expect((await createFixture(23, date, "16:00", 2)).error).toBeNull();
  expect((await createFixture(23, addDays(date, 1), "16:00", 2)).error).toBeNull();
  const { data: target } = await db.from("bookings").select("id").eq("phone", testPhone(23)).eq("booking_date", date).single();

  await loginBackoffice(page, "staff01");
  await page.goto(`/backoffice/bookings/${target!.id}`);
  await page.getByRole("button", { name: "แก้ไข", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const slots = dialog.getByRole("group", { name: "เวลา" });
  await expect(slots.getByRole("button", { name: "16:00", exact: true })).toBeVisible();
  for (const full of ["11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30"]) {
    await expect(slots.getByRole("button", { name: full, exact: true })).toHaveCount(0);
  }

  await dialog.locator("#bk-date").fill(addDays(date, 1));
  await slots.getByRole("button", { name: "17:00", exact: true }).click();
  await dialog.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(dialog).toContainText("1 เบอร์จองได้ 1 คิวต่อวัน");
  const { data: after } = await db.from("bookings").select("booking_date, start_time").eq("id", target!.id).single();
  expect(after).toEqual({ booking_date: date, start_time: "16:00:00" });
});

test("closing Tuesday, changing hours and adding a holiday reach the customer calendar (TC-091–093)", async ({ page }) => {
  // Earlier tests leave bookings that a closed Tuesday would affect (ADM-08); start without them.
  await cleanupTestData();
  await loginBackoffice(page, "admin01");
  try {
    await page.goto("/backoffice/hours");
    await page.getByRole("switch", { name: "เปิดทำการวันอังคาร" }).click();
    await page.getByLabel("เวลาปิดวันอาทิตย์").selectOption("21:00");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page.getByText("บันทึกเวลาทำการแล้ว")).toBeVisible();

    const holiday = addDays(date, 2);
    await page.locator("#holiday-date").fill(holiday);
    await page.getByRole("button", { name: "เพิ่ม", exact: true }).click();
    await expect(page.getByRole("button", { name: new RegExp(`ลบวันหยุด`) }).first()).toBeVisible();

    const tuesday = [1, 2, 3, 4, 5, 6, 7].map((d) => addDays(date, d)).find((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === 2)!;
    for (const [d, label] of [
      [tuesday, "ร้านปิด"],
      [holiday, "วันหยุดพิเศษ"],
    ]) {
      await page.goto("/");
      const days = section(page, "เลือกวันที่");
      await expect(days.getByRole("button", { name: "เดือนถัดไป" })).toBeVisible();
      await showMonth(days, d);
      await expect(days.getByRole("button", { name: `${formatThaiDate(d)} ${label}` })).toBeDisabled();
    }

    await page.goto("/");
    const days = section(page, "เลือกวันที่");
    const sunday = [0, 1, 2, 3, 4, 5, 6].map((d) => addDays(date, d)).find((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === 0)!;
    await section(page, "จำนวนที่นั่ง").getByRole("button", { name: "2", exact: true }).click();
    await pickDay(page, sunday, days);
    const slotButtons = section(page, "เลือกเวลา").getByRole("button");
    await expect(slotButtons.first()).toHaveText("11:00");
    await expect(slotButtons.last()).toHaveText("19:00");
  } finally {
    await restoreStore(snapshot);
  }
});

test("brief section 7 quota example at the database (TC-102)", async () => {
  // Brief: 40 active seats; A 18:00×8 and B 19:00×6 leave 26 seats at 19:30; closing A frees 8 at once.
  const { data: extra } = await db.from("dining_tables").insert({ name: "E2E-T20", seats: 20, is_active: true }).select("id").single();
  const day = addDays(date, 3);
  try {
    expect((await createFixture(30, day, "18:00", 8)).error).toBeNull();
    expect((await createFixture(31, day, "19:00", 6)).error).toBeNull();
    for (const n of [32, 33, 34]) expect((await createFixture(n, day, "19:30", 8)).error).toBeNull();
    expect((await createFixture(35, day, "19:30", 2)).error).toBeNull();
    expect((await createFixture(36, day, "19:30", 1)).error).toBe("no_quota");

    const { data: a } = await db.from("bookings").select("id").eq("phone", testPhone(30)).single();
    const now = new Date().toISOString();
    const base = { p_actor: null as unknown as string, p_actor_name: "E2E", p_id: a!.id, p_now: now };
    expect((await db.rpc("change_booking_status", { ...base, p_to: "arrived" })).error).toBeNull();
    expect((await db.rpc("assign_tables", { ...base, p_note: "", p_table_ids: [extra!.id] })).error).toBeNull();
    expect((await db.rpc("change_booking_status", { ...base, p_to: "closed" })).error).toBeNull();
    expect((await createFixture(36, day, "19:30", 8)).error).toBeNull();
  } finally {
    await cleanupTestData();
    await db.from("dining_tables").delete().eq("id", extra!.id);
  }
});

test("admin can open the calendar and the dashboard", async ({ page }) => {
  await loginBackoffice(page, "admin01");
  await page.goto("/backoffice/calendar");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/backoffice/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
