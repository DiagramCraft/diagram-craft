import { test as baseTest, type Page } from '@playwright/test';

const UI_LOGIN = {
  email: 'james.chen@example.com',
  password: 'test'
} as const;

export const test = baseTest.extend<{ loggedInPage: Page }>({
  loggedInPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.getByLabel('Username').fill(UI_LOGIN.email);
    await page.locator('#lg-pass').fill(UI_LOGIN.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/default**');
    await use(page);
  }
});

/** biome-ignore lint/performance/noBarrelFile: ok */
export { expect } from '@playwright/test';
