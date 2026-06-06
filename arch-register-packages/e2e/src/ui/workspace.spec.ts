import { test, expect } from '@playwright/test';
import { TEST_ADMIN } from '../helpers/seedHelper';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Username').fill(TEST_ADMIN.email);
  await page.locator('#lg-pass').fill(TEST_ADMIN.password);
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
