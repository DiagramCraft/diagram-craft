import { test, expect } from './fixtures';

const WS = 'default';

test.describe('entities section', () => {
  test('shows entity browser', async ({ loggedInPage: page }) => {
    await page.goto(`/${WS}/entities`);

    await expect(page.getByLabel('Entities')).toHaveAttribute('aria-pressed', 'true');

    await expect(page.getByRole('main').getByText('All entities')).toBeVisible();
    await expect(page.getByPlaceholder('Search by name, owner…')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New entity' })).toBeVisible();
  });
});
