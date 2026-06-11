import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { chromium, type FullConfig } from '@playwright/test';
import { LoginPage } from './src/ui/pages/LoginPage';
import { seededUserAuthStatePath } from './src/ui/support/authState';
import { defaultWorkspace } from './src/ui/support/workspaces';

const globalSetup = async (config: FullConfig) => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const loginPage = new LoginPage(page);
  const baseURL = config.projects[0]?.use?.baseURL;

  if (typeof baseURL !== 'string') {
    throw new Error('Playwright baseURL must be configured for e2e global setup.');
  }

  await mkdir(dirname(seededUserAuthStatePath), { recursive: true });
  await page.goto(new URL('/login', baseURL).toString());
  await loginPage.signInAsSeededUser();
  await page.waitForURL(`**/${defaultWorkspace.slug}**`);
  await context.storageState({ path: seededUserAuthStatePath });
  await browser.close();
};

export default globalSetup;
