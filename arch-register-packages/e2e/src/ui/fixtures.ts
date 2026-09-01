import { expect, test as base } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { defaultWorkspace } from './support/workspaces';

type UiTestOptions = {
  authenticated: boolean;
};

export const test = base.extend<UiTestOptions>({
  authenticated: [true, { option: true }],

  page: async ({ page, authenticated }, use) => {
    if (authenticated) {
      const loginPage = new LoginPage(page);

      await loginPage.goto();
      await loginPage.signInAsSeededUser();
      await page.waitForURL(url => url.pathname === `/${defaultWorkspace.slug}`);
      await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
    }

    await use(page);
  }
});
