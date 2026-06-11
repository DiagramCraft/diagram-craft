import { test } from '@playwright/test';
import { DataModelPage } from '../pages/DataModelPage';
import { defaultWorkspace } from '../support/workspaces';

test.describe('data model section', () => {
  test('shows schema editor', async ({ page }) => {
    const dataModelPage = new DataModelPage(page, defaultWorkspace.slug);

    await dataModelPage.goto();
    await dataModelPage.expectLoaded();
  });
});
