import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

// The E2E run shares the one Supabase project with production, so specs run one at a time,
// only create data under the E2E test phones and put back every setting they change.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    // Empty Gmail settings win over .env.local (Next never overrides a variable that is already
    // set), so the run sends no real email: booking mail is logged as skipped and the OTP is
    // replaced in the database by the test itself.
    env: { GMAIL_USER: "", GMAIL_APP_PASSWORD: "", NEXT_DIST_DIR: ".next-e2e" },
  },
});
