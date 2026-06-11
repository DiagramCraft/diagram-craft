import { test } from '@playwright/test';
import { SearchPage } from '../pages/SearchPage';
import { loginAsSeededUser } from '../support/auth';
import { defaultWorkspace } from '../support/workspaces';

test.describe('search section', () => {
  test('shows search interface', async ({ page }) => {
    const searchPage = new SearchPage(page, defaultWorkspace.slug);

    await loginAsSeededUser(page);
    await searchPage.goto();
    await searchPage.expectLoaded();
  });
});
