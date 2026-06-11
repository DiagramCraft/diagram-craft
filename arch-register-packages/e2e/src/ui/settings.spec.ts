import { test, expect } from './fixtures';

const WS = 'default';

test.describe('settings section', () => {
  test('shows workspace settings', async ({ loggedInPage: page }) => {
    await page.goto(`/${WS}/settings`);

    await expect(page.getByText('Workspace settings')).toBeVisible();
    // The section title in the main content area (scoped to avoid sidebar nav ambiguity)
    await expect(page.getByRole('main').getByText('General')).toBeVisible();
    await expect(page.getByText('Workspace name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();
  });
});
