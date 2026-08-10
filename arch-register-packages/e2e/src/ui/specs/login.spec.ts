import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { LoginPage } from '../pages/LoginPage';
import { defaultWorkspace } from '../support/workspaces';

test.use({ authenticated: false });

test('shows login form @quick', async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.goto();
  await loginPage.expectLoaded();
});

test('shows error on invalid credentials', async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.goto();
  await loginPage.signIn('wronguser', 'wrongpassword');
  await loginPage.expectError();
});

test('redirects to workspace after successful login @quick', async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.goto();
  await loginPage.signInAsSeededUser();
  await page.waitForURL(`**/${defaultWorkspace.slug}**`);
  await expect(page).toHaveURL(new RegExp(`/${defaultWorkspace.slug}`));
});
