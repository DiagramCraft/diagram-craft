import { test } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { loginAsSeededUser } from '../support/auth';
import { defaultWorkspace } from '../support/workspaces';

test.describe('home section', () => {
  test('shows workspace overview', async ({ page }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);

    await loginAsSeededUser(page);
    await homePage.goto();
    await homePage.expectLoaded(defaultWorkspace.name);
  });
});
