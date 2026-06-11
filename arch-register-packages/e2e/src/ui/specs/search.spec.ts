import { test } from '@playwright/test';
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
});
