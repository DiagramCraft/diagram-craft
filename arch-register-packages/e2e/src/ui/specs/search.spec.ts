import { expect, test } from '@playwright/test';
import { SearchPage } from '../pages/SearchPage';
import { defaultWorkspace } from '../support/workspaces';

test.describe('search section', () => {
  test('shows search interface', async ({ page }) => {
    const searchPage = new SearchPage(page, defaultWorkspace.slug);

    await searchPage.goto();
    await searchPage.expectLoaded();
  });

  test('returns entity results when searching', async ({ page }) => {
    const searchPage = new SearchPage(page, defaultWorkspace.slug);

    await searchPage.goto();
    await searchPage.expectLoaded();
    await searchPage.search('API');
    await searchPage.expectEntityResultsFound();
  });

  test('restores the selected category through reload and browser history', async ({ page }) => {
    const searchPage = new SearchPage(page, defaultWorkspace.slug);

    await searchPage.goto();
    await searchPage.search('API');
    await page.getByTestId('search-category-Entities').click();
    await expect(page).toHaveURL(/category=entities/);

    await page.reload();
    await expect(page.getByTestId('search-category-Entities')).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    await page.goBack();
    await expect(page).not.toHaveURL(/category=/);
  });
});
