import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.PMS_E2E_URL ?? "http://127.0.0.1:5173",
    channel: "msedge",
    headless: true,
  },
  reporter: "list",
});
