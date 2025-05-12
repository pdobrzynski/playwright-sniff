import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './examples',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['dot'],
  ],
  use: {
    trace: 'on-first-retry',
    sniffOptions: {
      slowThreshold: 2000,
      outputFile: 'sniffing-results.json',
      outputHTML: 'sniffing-report.html',
      captureScreenshots: false,
    }
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
