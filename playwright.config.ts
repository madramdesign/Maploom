import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const PORT = 3217;
const root = import.meta.dirname;

/**
 * End-to-end tests run fully offline: map data comes from the checked-in
 * fixture tiles and the demo location is used instead of live geocoding.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'off' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1360, height: 860 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      MAPLOOM_ROOT: root,
      MAPLOOM_FIXTURE_TILES: resolve(root, 'tests/fixtures/tiles'),
      MAPLOOM_DATA_DIR: resolve(root, '.data/e2e'),
      ADMIN_TOKEN: 'e2e-admin-token-0123456789',
    },
  },
});
