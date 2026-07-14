import { expect, test } from '@playwright/test';
import { defaultWorkspace } from '../support/workspaces';

const WIKI_HOME_ID = '00000000-0000-0000-0031-000000000006';

test.describe('markdown editor', () => {
  test('renders the seeded wiki page @quick', async ({ page }) => {
    await page.goto(`/${defaultWorkspace.slug}/content/wiki/${WIKI_HOME_ID}`);

    await expect(
      page.getByRole('heading', { name: 'Example Corp Wiki', exact: true })
    ).toBeVisible();
    await expect(page.getByText('Welcome to the Example Corp architecture wiki.')).toBeVisible();
  });

  test('restores editor mode through reload and browser history', async ({ page }) => {
    await page.goto(`/${defaultWorkspace.slug}/content/wiki/${WIKI_HOME_ID}`);
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page).toHaveURL(/mode=edit/);

    await page.reload();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();

    await page.goBack();
    await expect(page).not.toHaveURL(/mode=edit/);
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeEnabled();
  });
});
