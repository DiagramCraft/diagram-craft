import { test as baseTest, type Page } from '@playwright/test';

const DEFAULT_DIAGRAM = '/?crdtClear=true#/BPMN.json';

export const test = baseTest.extend<{ appPage: Page }>({
  appPage: async ({ page }, use) => {
    await page.goto(DEFAULT_DIAGRAM);
    await page.getByRole('toolbar').first().waitFor();
    await use(page);
  }
});

export { expect } from '@playwright/test';
