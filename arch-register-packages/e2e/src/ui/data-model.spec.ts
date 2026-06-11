import { test, expect } from './fixtures';

const WS = 'default';

test.describe('data model section', () => {
  test('shows schema editor', async ({ loggedInPage: page }) => {
    await page.goto(`/${WS}/model`);

    await expect(page.getByLabel('Data model')).toHaveAttribute('aria-pressed', 'true');

    await expect(page.getByText('Schema', { exact: true })).toBeVisible();
    await expect(
      page.getByText('Define the entity types that everything in this workspace conforms to.')
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'New entity type' })).toBeVisible();
  });
});
