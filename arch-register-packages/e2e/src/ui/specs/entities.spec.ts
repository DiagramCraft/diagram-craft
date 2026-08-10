import { readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { EntitiesPage } from '../pages/EntitiesPage';
import {
  authApiEntity,
  customerApiEntity,
  frontendAppEntity,
  notificationsApiEntity,
  seededApiEntityCount
} from '../support/entities';
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
    await entitiesPage.expectFilteredResultCount(seededApiEntityCount);
  });

  test('opens an entity detail from the browser @quick', async ({ page }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);

    await entitiesPage.goto();
    await entitiesPage.openEntity(authApiEntity.name);
    await entitiesPage.expectEntityDetailLoaded(authApiEntity.name);
  });

  test('enters entity edit mode without saving', async ({ page }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);

    await entitiesPage.goto();
    await entitiesPage.openEntity(authApiEntity.name);
    await entitiesPage.startEditingEntity();
  });

  test('opens entity actions and detail dialogs', async ({ page }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);

    await entitiesPage.goto();
    await entitiesPage.openEntity(authApiEntity.name);
    await entitiesPage.openEntityJsonDialog();
    await page.getByRole('button', { name: 'Close' }).click();
    await entitiesPage.openCollectionsDialog();
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

  test('loads tree view without the redundant entity list request', async ({ page }) => {
    const entityListRequests: string[] = [];
    page.on('request', request => {
      const pathname = new URL(request.url()).pathname;
      if (pathname === '/api/application/v1/default/data') entityListRequests.push(pathname);
    });

    const treeResponse = page.waitForResponse(response => {
      const pathname = new URL(response.url()).pathname;
      return pathname === '/api/application/v1/default/data/tree' && response.ok();
    });

    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);
    await entitiesPage.goto({ viewMode: 'tree' });
    await treeResponse;
    await entitiesPage.expectLoaded();

    expect(entityListRequests).toHaveLength(0);
  });

  test('restores entity tabs through reload and browser history', async ({ page }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);

    await entitiesPage.goto();
    await entitiesPage.openEntity(authApiEntity.name);
    // The "Topology" tab lives inside the "Context" sidebar section — its tab
    // bar (and the Topology trigger) only renders once that section is active.
    await page.getByText('Context', { exact: true }).click();
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

  test('browses normalized OpenAPI operations and keeps API filters shareable', async ({ page }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);
    await entitiesPage.goto();
    await entitiesPage.seedApiSpecification(authApiEntity.id, {
      openapi: '3.1.0',
      info: { title: 'Auth API', version: 'v1' },
      paths: {
        '/pets': {
          get: {
            operationId: 'listPets',
            summary: 'List pets',
            responses: { '200': { description: 'ok' } }
          }
        }
      }
    });
    await entitiesPage.goto();
    await entitiesPage.openApiCatalog(authApiEntity.name);

    await expect(page.getByText('OpenAPI catalog')).toBeVisible();
    await expect(page.getByText('listPets')).toBeVisible();
    await page.getByPlaceholder('Search identifier, summary, path or channel').fill('listPets');
    await expect(page).toHaveURL(/apiQ=listPets/);

    await page.reload();
    await expect(page.getByText('listPets')).toBeVisible();
    await expect(page.getByRole('button', { name: 'View raw source' })).toHaveCount(0);
    await page.locator('summary').filter({ hasText: 'listPets' }).click();
    await page.getByRole('button', { name: 'View source' }).click();
    await expect(page.getByRole('alertdialog', { name: 'Raw API source' })).toBeVisible();
  });

  test('browses normalized AsyncAPI messages', async ({ page }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);
    await entitiesPage.goto();
    await entitiesPage.seedApiSpecification(notificationsApiEntity.id, {
      asyncapi: '2.6.0',
      info: { title: 'Notifications', version: '1.0.0' },
      channels: {
        'orders.created': {
          publish: {
            message: { payload: { type: 'object' } }
          }
        }
      }
    });
    await entitiesPage.goto();
    await entitiesPage.openApiCatalog(notificationsApiEntity.name);

    await expect(page.getByText('AsyncAPI catalog')).toBeVisible();
    await expect(page.getByText('orders.created', { exact: true })).toBeVisible();
    await expect(page.locator('summary').getByText('PUBLISH', { exact: true })).toBeVisible();
  });

  test('restores entity filters through reload and browser history', async ({ page }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);

    await entitiesPage.goto();
    await entitiesPage.filterByType(apiSchema.name);
    await page.reload();
    await entitiesPage.expectFilteredResultCount(seededApiEntityCount);

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

  test('restores entity content filter and view mode through reload and browser history', async ({
    page
  }) => {
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
