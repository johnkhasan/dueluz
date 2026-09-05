import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;

/**
 * Smoke coverage for the two flows the product cannot ship without:
 * an anonymous visitor voting, and a signed-in user creating a duel.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: 'pnpm --filter @dueluz/web dev',
        url: baseURL,
        cwd: '../..',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
