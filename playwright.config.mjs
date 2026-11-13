import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/security',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4179',
    // Optional local system browser; CI installs Playwright's pinned Chromium.
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4179 --strictPort',
    url: 'http://127.0.0.1:4179/tests/fixtures/blank.html',
    reuseExistingServer: false,
  },
})
