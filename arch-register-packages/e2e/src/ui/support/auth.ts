import type { Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { defaultWorkspace } from './workspaces';

export const loginAsSeededUser = async (page: Page) => {
  const loginPage = new LoginPage(page);

  await loginPage.goto();
  await loginPage.signInAsSeededUser();
  await page.waitForURL(`**/${defaultWorkspace.slug}**`);
};
