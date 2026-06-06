import type { Page } from '@playwright/test';

export const waitForApplicationLoaded = async (page: Page) => {
  await page.getByRole('toolbar').first().waitFor();
};
