import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'admin@e2e.test';
const TEST_PASSWORD = 'TestPassword123!';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Username').fill(TEST_EMAIL);
  await page.locator('#lg-pass').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/default**');
}

test('shows default workspace after login', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('main').getByText('Default Workspace', { exact: true })).toBeVisible();
});

test('navigates to entity list', async ({ page }) => {
  await login(page);
  await page.goto('/default/entities');
  await expect(page.getByRole('main')).toBeVisible();
});
