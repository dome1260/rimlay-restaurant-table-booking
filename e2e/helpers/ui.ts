import { expect, type Locator, type Page } from "@playwright/test";
import { config } from "dotenv";
import { formatThaiDate } from "../../src/lib/booking/format";
import { bangkokToday } from "./db";

config({ path: ".env.local", quiet: true });

export function section(page: Page, title: string) {
  return page.locator("section").filter({ has: page.getByRole("heading", { name: title }) });
}

// The customer calendar opens on the current month; booking is limited to one month ahead.
export async function showMonth(scope: Locator, date: string, from = bangkokToday()) {
  const [fy, fm] = from.split("-").map(Number);
  const [y, m] = date.split("-").map(Number);
  for (let i = 0; i < (y - fy) * 12 + (m - fm); i++) {
    await scope.getByRole("button", { name: "เดือนถัดไป" }).click();
  }
}

export async function pickDay(page: Page, date: string, scope: Locator = page.locator("body")) {
  await expect(scope.getByRole("button", { name: "เดือนถัดไป" })).toBeVisible();
  await showMonth(scope, date);
  await scope.getByRole("button", { name: formatThaiDate(date), exact: false }).first().click();
}

export async function bookAsCustomer(
  page: Page,
  b: { party: number; date: string; time: string; name: string; phone: string; email: string },
) {
  await page.goto("/");
  await section(page, "จำนวนที่นั่ง").getByRole("button", { name: String(b.party), exact: true }).click();
  await pickDay(page, b.date, section(page, "เลือกวันที่"));
  await section(page, "เลือกเวลา").getByRole("button", { name: b.time, exact: true }).click();
  await page.locator("#web-name").fill(b.name);
  await page.locator("#web-phone").fill(b.phone);
  await page.locator("#web-email").fill(b.email);
  await page.locator("aside").getByRole("button", { name: "ยืนยันการจอง" }).click();
}

export async function loginBackoffice(page: Page, username: "admin01" | "staff01") {
  const password = process.env.SEED_TEST_PASSWORD;
  if (!password) throw new Error("Missing SEED_TEST_PASSWORD in .env.local");
  await page.goto("/backoffice/login");
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
