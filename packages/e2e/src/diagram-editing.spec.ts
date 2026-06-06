import { test, expect } from '@playwright/test';
import { waitForApplicationLoaded } from './helpers/testUtils.js';

test('canvas is present and visible', async ({ page }) => {
  await page.goto('/?crdtClear=true#/BPMN.json');
  await waitForApplicationLoaded(page);
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();
});
