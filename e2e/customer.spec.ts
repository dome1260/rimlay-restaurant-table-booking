import { expect, test, type Page } from "@playwright/test";
import { summarizeHours } from "../src/lib/store/hours-summary";
import { addDays, formatThaiDate } from "../src/lib/booking/format";
import { bangkokToday, cleanupTestData, db, forceOtp, pickTestDate, testEmail, testPhone, TEST_NAME } from "./helpers/db";
import { bookAsCustomer, section } from "./helpers/ui";

// TSK-056: customer web app — book, find with OTP, edit, cancel, lock.
test.describe.configure({ mode: "serial" });

let date: string;

test.beforeAll(async () => {
  await cleanupTestData();
  date = await pickTestDate(5);
});

async function signIn(page: Page, phone: string) {
  await page.goto("/my-booking");
  await page.locator("#find-phone").fill(phone);
  await page.getByRole("button", { name: "ส่งรหัส OTP" }).click();
  await expect(page.getByLabel("รหัส OTP 6 หลัก")).toBeVisible();
  await forceOtp(phone);
  await page.getByLabel("รหัส OTP 6 หลัก").fill("123456");
  await page.getByRole("button", { name: "ยืนยันรหัส" }).click();
  await expect(page.getByRole("heading", { name: "คิวที่กำลังจะถึง" })).toBeVisible();
}

test("books a table and refuses a second booking for the same phone that day", async ({ page }) => {
  const phone = testPhone(1);
  await bookAsCustomer(page, { party: 2, date, time: "19:00", name: `${TEST_NAME} ลูกค้า`, phone, email: testEmail(1) });
  await expect(page.getByRole("heading", { name: "จองสำเร็จ" })).toBeVisible();
  await expect(page.getByText("19:00 น.")).toBeVisible();

  const { data } = await db.from("bookings").select("status, channel, party_size, start_time").eq("phone", phone);
  expect(data).toEqual([{ status: "waiting", channel: "web", party_size: 2, start_time: "19:00:00" }]);

  await page.getByRole("button", { name: "จองโต๊ะอีกครั้ง" }).click();
  await bookAsCustomer(page, { party: 2, date, time: "12:00", name: `${TEST_NAME} ลูกค้า`, phone, email: testEmail(1) });
  await expect(page.locator("aside").getByText("1 เบอร์จองได้ 1 คิวต่อวัน")).toBeVisible();
});

test("finds the booking with an email OTP, edits it and cancels it", async ({ page }) => {
  const phone = testPhone(1);
  await signIn(page, phone);
  const card = page.locator("article").filter({ hasText: "19:00 น. · 2 ท่าน" });
  await expect(card).toBeVisible();
  await expect(card).not.toContainText(/ends_at|21:00/);

  await card.getByRole("button", { name: "แก้ไข" }).click();
  const form = page.getByRole("form", { name: /แก้ไขคิว/ });
  await form.locator("fieldset").filter({ hasText: "จำนวนที่นั่ง" }).getByRole("button", { name: "4", exact: true }).click();
  await form.getByRole("button", { name: "20:00", exact: true }).click();
  await form.getByRole("button", { name: "บันทึกการเปลี่ยนแปลง" }).click();
  const edited = page.locator("article").filter({ hasText: "20:00 น. · 4 ท่าน" });
  await expect(edited).toBeVisible();

  await edited.getByRole("button", { name: "ยกเลิกคิว" }).click();
  await page.getByRole("button", { name: "ยืนยันยกเลิกคิว" }).click();
  await expect(page.getByText("ไม่มีคิวที่กำลังจะถึง")).toBeVisible();

  const { data } = await db.from("bookings").select("status, party_size, start_time").eq("phone", phone);
  expect(data).toEqual([{ status: "cancelled", party_size: 4, start_time: "20:00:00" }]);
  const { data: events } = await db
    .from("booking_events")
    .select("kind, actor_kind")
    .eq("booking_id", (await db.from("bookings").select("id").eq("phone", phone).single()).data!.id)
    .order("created_at");
  expect(events?.map((e) => `${e.kind}:${e.actor_kind}`)).toEqual(["created:customer", "edited:customer", "status:customer"]);
});

test("locks the phone after 5 wrong OTP codes", async ({ page }) => {
  const phone = testPhone(2);
  await bookAsCustomer(page, { party: 2, date: addDays(date, 1), time: "13:00", name: `${TEST_NAME} ล็อก`, phone, email: testEmail(2) });
  await expect(page.getByRole("heading", { name: "จองสำเร็จ" })).toBeVisible();

  await page.goto("/my-booking");
  await page.locator("#find-phone").fill(phone);
  await page.getByRole("button", { name: "ส่งรหัส OTP" }).click();
  const input = page.getByLabel("รหัส OTP 6 หลัก");
  await expect(input).toBeVisible();
  await forceOtp(phone, "123456");
  const failures = async () =>
    (await db.from("customer_otps").select("failed_count").eq("phone", phone).single()).data?.failed_count;
  for (let i = 1; i <= 5; i++) {
    await input.fill("000000");
    await page.getByRole("button", { name: "ยืนยันรหัส" }).click();
    await expect.poll(failures).toBe(i);
  }
  await expect(page.getByText("เบอร์นี้ถูกล็อกชั่วคราว")).toBeVisible();
  const { data } = await db.from("customer_otps").select("locked_until").eq("phone", phone).single();
  expect(Date.parse(data!.locked_until!)).toBeGreaterThan(Date.now() + 14 * 60_000);
});

test("footer shows the opening hours from the database (TC-123)", async ({ page }) => {
  const { data } = await db.from("business_hours").select("*");
  await page.goto("/");
  await expect(page.locator("footer")).toContainText(summarizeHours(data ?? []));
});

test("calendar only offers dates up to one month ahead", async ({ page }) => {
  await page.goto("/");
  const days = section(page, "เลือกวันที่");
  await expect(days.getByRole("button", { name: "เดือนก่อนหน้า" })).toBeDisabled();
  await days.getByRole("button", { name: "เดือนถัดไป" }).click();
  await expect(days.getByRole("button", { name: "เดือนถัดไป" })).toBeDisabled();
  const tooFar = days.getByRole("button", { name: formatThaiDate(addDays(bangkokToday(), 32)) });
  if (await tooFar.count()) await expect(tooFar).toBeDisabled();
});
