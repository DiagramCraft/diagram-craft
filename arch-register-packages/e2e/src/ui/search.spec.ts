import { test, expect } from './fixtures';

const WS = 'default';

test.describe('search section', () => {
  test('shows search interface', async ({ loggedInPage: page }) => {
    await page.goto(`/${WS}/search`);

    await expect(page.getByLabel('Search')).toHaveAttribute('aria-pressed', 'true');

    await expect(
      page.getByPlaceholder('Search entities, diagrams, projects, schema…')
    ).toBeVisible();
    await expect(page.getByText('Start typing to search across the workspace.')).toBeVisible();
  });
});
