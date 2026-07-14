import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { EntitiesPage } from '../pages/EntitiesPage';
import { authApiEntity, customerApiEntity, frontendAppEntity } from '../support/entities';
import { apiSchema } from '../support/schemas';
import { defaultWorkspace } from '../support/workspaces';

test.describe('entities section', () => {
  test('shows entity browser @quick', async ({ page }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);

    await entitiesPage.goto();
    await entitiesPage.expectLoaded();
  });

  test('filters entities by type in the sidebar @quick', async ({ page }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);

    await entitiesPage.goto();
    await entitiesPage.expectLoaded();
    await entitiesPage.filterByType(apiSchema.name);
    await entitiesPage.expectFilteredResultCount(2);
  });

  test('shows the entity browser in table view', async ({ page }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);

    await entitiesPage.switchView('table');
    await expect(page).toHaveURL(/viewMode=table/);
    await entitiesPage.expectLoaded();
  });

  test('shows the entity browser in cards view', async ({ page }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);

    await entitiesPage.switchView('cards');
    await expect(page).toHaveURL(/viewMode=cards/);
    await entitiesPage.expectLoaded();
  });

  test('shows the entity browser in tree view', async ({ page }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);

    await entitiesPage.switchView('tree');
    await expect(page).toHaveURL(/viewMode=tree/);
    await entitiesPage.expectLoaded();
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

  test('restores entity content filter and view mode through reload and browser history', async ({ page }) => {
    await page.goto(
      `/${defaultWorkspace.slug}/entities/${authApiEntity.publicId}/folders/security`
    );

    const filterInput = page.getByPlaceholder('Filter diagrams…');
    const listViewButton = page.locator('button[title="List view"]');

    await expect(page.getByRole('heading', { name: 'Security' })).toBeVisible();

    await filterInput.fill('Threat');
    await expect(page).toHaveURL(/contentQuery=Threat/);

    await listViewButton.click();
    await expect(page).toHaveURL(/contentView=list/);
    await expect(page.getByText('Threat Model')).toBeVisible();
    await expect(page.getByText('Name')).toBeVisible();

    await page.reload();
    await expect(filterInput).toHaveValue('Threat');
    await expect(page.getByText('Threat Model')).toBeVisible();
    await expect(page.getByText('Name')).toBeVisible();

    await page.goBack();
    await expect(filterInput).toHaveValue('Threat');
    await expect(page).not.toHaveURL(/contentView=list/);
    await expect(page.getByText('Name')).toHaveCount(0);
    await expect(page.getByText('Threat Model')).toBeVisible();
  });

  test('navigates directly to nested entity content folders', async ({ page }) => {
    await page.goto(
      `/${defaultWorkspace.slug}/entities/${authApiEntity.publicId}/folders/security/guides`
    );

    await expect(page).toHaveURL(/\/entities\/API-2\/folders\/security\/guides$/);
    await expect(page.getByRole('heading', { name: 'security/guides', exact: true })).toBeVisible();
  });
});
