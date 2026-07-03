import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { EntitiesPage } from '../pages/EntitiesPage';
import { authApiEntity, customerApiEntity, frontendAppEntity } from '../support/entities';
import { apiSchema } from '../support/schemas';
import { defaultWorkspace } from '../support/workspaces';

test.describe('entities section', () => {
  test('shows entity browser', async ({ page }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);

    await entitiesPage.goto();
    await entitiesPage.expectLoaded();
  });

  test('filters entities by type in the sidebar', async ({ page }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);

    await entitiesPage.goto();
    await entitiesPage.expectLoaded();
    await entitiesPage.filterByType(apiSchema.name);
    await entitiesPage.expectFilteredResultCount(2);
  });

  test('restores entity tabs through reload and browser history', async ({ page }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);

    await entitiesPage.goto();
    await entitiesPage.openEntity(authApiEntity.name);
    await page.getByRole('tab', { name: 'Topology' }).click();
    await expect(page).toHaveURL(/tab=topology/);

    await page.reload();
    await expect(page.getByRole('tab', { name: 'Topology' })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    await page.goBack();
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  test('restores entity filters through reload and browser history', async ({ page }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);

    await entitiesPage.goto();
    await entitiesPage.filterByType(apiSchema.name);
    await page.reload();
    await entitiesPage.expectFilteredResultCount(2);

    await page.goBack();
    await expect(entitiesPage.browserTitle()).toHaveText('All entities');
  });

  test('exports filtered entities to CSV', async ({ page }, testInfo) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);

    await entitiesPage.goto();
    await entitiesPage.expectLoaded();
    await entitiesPage.filterByType(apiSchema.name);

    const [download] = await Promise.all([page.waitForEvent('download'), entitiesPage.exportCsv()]);
    const downloadPath = testInfo.outputPath('entities-export.csv');
    await download.saveAs(downloadPath);

    const csv = await readFile(downloadPath, 'utf8');
    expect(csv).toContain(customerApiEntity.name);
    expect(csv).toContain(authApiEntity.name);
    expect(csv).not.toContain(frontendAppEntity.name);
  });

  test('opens the new entity dialog', async ({ page }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);

    await entitiesPage.goto();
    await entitiesPage.expectLoaded();
    await entitiesPage.openNewEntityDialog();
  });
});
