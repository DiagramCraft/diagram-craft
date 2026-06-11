import { test } from '@playwright/test';
import { EntitiesPage } from '../pages/EntitiesPage';
import { loginAsSeededUser } from '../support/auth';
import { defaultWorkspace } from '../support/workspaces';

test.describe('entities section', () => {
  test('shows entity browser', async ({ page }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);

    await loginAsSeededUser(page);
    await entitiesPage.goto();
    await entitiesPage.expectLoaded();
  });
});
