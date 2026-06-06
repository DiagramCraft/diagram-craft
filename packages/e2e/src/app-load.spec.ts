import { test, expect } from '@playwright/test';
import { waitForApplicationLoaded } from './helpers/testUtils.js';

test('app loads and shows toolbar', async ({ page }) => {
  await page.goto('/?crdtClear=true#/BPMN.json');
  await waitForApplicationLoaded(page);
  await expect(page.getByRole('toolbar').first()).toBeVisible();
});

test('can switch diagram tabs', async ({ page }) => {
  await page.goto('/?crdtClear=true&disable-export-fix=true#/BPMN.json');
  await waitForApplicationLoaded(page);
  const tablist = page.getByRole('tablist', { name: 'Diagrams in document' });
  const tabs = tablist.getByRole('tab');
  await tabs.nth(1).click();
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
});
