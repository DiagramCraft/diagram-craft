import { test, expect } from '@playwright/test';
import { TEST_ADMIN } from '../helpers/seedHelper';

test('shows login form', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText('Arch Register')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByLabel('Username')).toBeVisible();
  await expect(page.locator('#lg-pass')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});

test('shows error on invalid credentials', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('wronguser');
  await page.locator('#lg-pass').fill('wrongpassword');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
});

test('redirects to workspace after successful login', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill(TEST_ADMIN.email);
  await page.locator('#lg-pass').fill(TEST_ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/default**');
  await expect(page).toHaveURL(/\/default/);
});
