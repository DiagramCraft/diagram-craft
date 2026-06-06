import { test, expect } from './fixtures';

test('app loads and shows toolbar', async ({ appPage }) => {
  await expect(appPage.getByRole('toolbar').first()).toBeVisible();
});

test('can switch diagram tabs', async ({ page }) => {
  await page.goto('/?crdtClear=true&disable-export-fix=true#/BPMN.json');
  await page.getByRole('toolbar').first().waitFor();
  const tablist = page.getByRole('tablist', { name: 'Diagrams in document' });
  const tabs = tablist.getByRole('tab');
  await tabs.nth(1).click();
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
});
