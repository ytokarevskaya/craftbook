import { defineConfig } from "@playwright/test";
export default defineConfig({
 testDir: "./tests/e2e",
 fullyParallel: false,
 workers: 1,
 timeout: 60000,
 reporter: "list",
 use: { baseURL: "http://127.0.0.1:3100", channel: "chrome", trace: "off", screenshot: "off", video: "off" },
 webServer: {
  command: "npm run start -- --hostname 127.0.0.1 --port 3100",
  url: "http://127.0.0.1:3100/api/health",
  env: { APP_URL: "http://127.0.0.1:3100", NEXT_TELEMETRY_DISABLED: "1" },
  reuseExistingServer: false,
 },
});
