import { test, expect } from './fixtures';

const WS = 'default';

test.describe('home section', () => {
  test('shows workspace overview', async ({ loggedInPage: page }) => {
    await page.goto(`/${WS}`);

    await expect(page.getByLabel('Workspace overview')).toBeVisible();
    await expect(page.getByLabel('Workspace overview')).toHaveAttribute('aria-pressed', 'true');

    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('main').getByText('Default Workspace', { exact: true })).toBeVisible();
    // Stat cards visible on the home screen
    await expect(page.getByText('Entities').first()).toBeVisible();
    await expect(page.getByText('Projects').first()).toBeVisible();
  });
});
