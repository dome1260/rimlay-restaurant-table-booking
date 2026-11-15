import { cleanupTestData } from "./helpers/db";

export default async function globalTeardown() {
  await cleanupTestData();
}
