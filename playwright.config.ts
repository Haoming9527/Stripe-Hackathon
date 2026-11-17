import { existsSync } from "node:fs";
import { chromium, defineConfig, devices } from "@playwright/test";

const browserCandidates = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  chromium.executablePath(),
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
].filter((value): value is string => Boolean(value));
const executablePath = browserCandidates.find((candidate) => existsSync(candidate));

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 12_000 },
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3101",
    headless: true,
    actionTimeout: 15_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
});
