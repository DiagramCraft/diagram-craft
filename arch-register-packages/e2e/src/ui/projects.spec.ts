import { test, expect } from './fixtures';

const WS = 'default';

test.describe('projects section', () => {
  test('opens a seeded project from the workspace rail', async ({ loggedInPage: page }) => {
    await page.goto(`/${WS}`);

    await page.getByLabel('Projects').click();

    await page.waitForURL(`**/${WS}/projects/**`);
    await expect(page.getByRole('main').getByRole('heading', { name: 'Auth Migration' })).toBeVisible();
  });
});
