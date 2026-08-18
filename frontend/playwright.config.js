const { defineConfig, devices } = require('@playwright/test');

const backendEnv = {
  NODE_ENV: 'test',
  PORT: '3001',
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: process.env.DB_PORT || '5432',
  DB_NAME: process.env.DB_NAME || 'estoque_med_e2e_test',
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || 'postgres',
  JWT_SECRET: process.env.JWT_SECRET || 'e2e-test-secret-not-for-production',
  CORS_ORIGIN: 'http://127.0.0.1:3000',
  RATE_LIMIT_MAX: '1000',
  LOGIN_RATE_LIMIT_MAX: '1000'
};

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm --prefix ../backend start',
      url: 'http://127.0.0.1:3001/health',
      timeout: 30_000,
      reuseExistingServer: false,
      env: backendEnv
    },
    {
      command: 'npm start',
      url: 'http://127.0.0.1:3000',
      timeout: 60_000,
      reuseExistingServer: false,
      env: { ...process.env, BROWSER: 'none', PORT: '3000', REACT_APP_API_URL: 'http://127.0.0.1:3001' }
    }
  ]
});
