import { test } from '@playwright/test';
import { DataModelPage } from '../pages/DataModelPage';
import { componentSchema } from '../support/schemas';
import { defaultWorkspace } from '../support/workspaces';

test.describe('data model section', () => {
  test('shows schema editor', async ({ page }) => {
    const dataModelPage = new DataModelPage(page, defaultWorkspace.slug);

    await dataModelPage.goto();
    await dataModelPage.expectLoaded();
  });

  test('opens a schema type from the sidebar', async ({ page }) => {
    const dataModelPage = new DataModelPage(page, defaultWorkspace.slug);

    await dataModelPage.goto();
    await dataModelPage.expectLoaded();
    await dataModelPage.openSchemaType(componentSchema.name);
  });

  test('creates a new entity type', async ({ page }) => {
    const dataModelPage = new DataModelPage(page, defaultWorkspace.slug);

    await dataModelPage.goto();
    await dataModelPage.expectLoaded();

    try {
      await dataModelPage.createNewEntityType();
    } finally {
      await dataModelPage.deleteSelectedEntityType();
    }
  });
});
