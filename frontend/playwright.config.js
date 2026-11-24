import { defineConfig, devices } from '@playwright/test';

const isolatedCI = process.env.CAMPUSSWAP_CI_TEST === '1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: isolatedCI ? 'list' : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:8081',
    trace: isolatedCI ? 'off' : 'retain-on-failure',
    screenshot: isolatedCI ? 'off' : 'only-on-failure',
    video: isolatedCI ? 'off' : 'retain-on-failure',
    ...(isolatedCI && {
      // Chromium bypasses the proxy for loopback. Public requests fail unless mocked by a test.
      launchOptions: { args: ['--proxy-server=http://127.0.0.1:1'] }
    })
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  outputDir: 'test-results'
});
