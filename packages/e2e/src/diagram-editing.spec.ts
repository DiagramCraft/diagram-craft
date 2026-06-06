import { test, expect } from './fixtures';

test('canvas is present and visible', async ({ appPage }) => {
  await expect(appPage.locator('canvas').first()).toBeVisible();
});
