import { test as baseTest, type Page } from '@playwright/test';
import { TEST_ADMIN } from '../helpers/seedHelper';

export const test = baseTest.extend<{ loggedInPage: Page }>({
  loggedInPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.getByLabel('Username').fill(TEST_ADMIN.email);
    await page.locator('#lg-pass').fill(TEST_ADMIN.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/default**');
    await use(page);
  }
});

/** biome-ignore lint/performance/noBarrelFile: ok */
export { expect } from '@playwright/test';
