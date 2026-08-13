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
import { apiSchema, componentSchema } from '../support/schemas';
import { defaultWorkspace } from '../support/workspaces';

test.describe('entities section', () => {
  test('shows entity browser @quick', async ({ page }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);

    await entitiesPage.goto();
    await entitiesPage.expectLoaded();
    await expect(entitiesPage.homeTab()).toBeVisible();
    await entitiesPage.baselinesTab().click();
    await expect(entitiesPage.workspaceBaselinesSection()).toBeVisible();
  });

  test('opens workspace baseline creation from the entity actions menu', async ({ page }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);

    await entitiesPage.goto();
    await entitiesPage.expectLoaded();
    await entitiesPage.filterByType(apiSchema.name);
    await entitiesPage.openCreateBaselineDialog();
    await expect(page.getByText('Current filters and search', { exact: true })).toBeVisible();
  });

  test('opens a workspace baseline in the entity context', async ({ page }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);
    const baseline = await entitiesPage.createWorkspaceBaseline(`UI workspace ${Date.now()}`);

    await entitiesPage.goto();
    await entitiesPage.baselinesTab().click();
    await entitiesPage.page.getByTestId(`workspace-baseline-${baseline.id}`).click();

    await expect(entitiesPage.page).toHaveURL(new RegExp(`baselineId=${baseline.id}`));
    await expect(entitiesPage.page.getByRole('heading', { name: baseline.name })).toBeVisible();
    await expect(entitiesPage.page.getByRole('button', { name: 'Export JSON' })).toBeVisible();
    await entitiesPage.page.getByRole('button', { name: 'Remove', exact: true }).click();
    const deleteDialog = entitiesPage.page.getByRole('alertdialog', { name: 'Remove baseline?' });
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(entitiesPage.page.getByRole('tab', { name: 'Entities' })).toBeVisible();
    await expect(entitiesPage.page.getByRole('tab', { name: 'Relations' })).toBeVisible();
    await expect(entitiesPage.page.getByRole('tab', { name: 'Compare' })).toBeVisible();
    await entitiesPage.page.getByRole('tab', { name: 'Compare' }).click();
    await expect(
      entitiesPage.page.getByText('Compare with current state', { exact: true })
    ).toBeVisible();
    await expect(
      entitiesPage.page.getByRole('button', { name: /Back to (Entities|baselines)/ })
    ).toHaveCount(0);
  });

  test('filters entities by type in the sidebar @quick', async ({ page }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);

    await entitiesPage.goto();
    await entitiesPage.expectLoaded();
    await entitiesPage.filterByType(apiSchema.name);
    await entitiesPage.expectFilteredResultCount(seededApiEntityCount);
  });

  test('combines, restores, and clears multiple sidebar facets', async ({ page }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);

    await entitiesPage.goto();
    await entitiesPage.expectLoaded();
    await entitiesPage.typeFilter(apiSchema.name).click();
    await entitiesPage.typeFilter(componentSchema.name).click();

    await expect(entitiesPage.facetCheckbox(apiSchema.name)).toBeChecked();
    await expect(entitiesPage.facetCheckbox(componentSchema.name)).toBeChecked();
    const combinedCount = Number(await entitiesPage.browserCount().textContent());
    expect(combinedCount).toBeGreaterThan(seededApiEntityCount);

    const readFilters = () => {
      const parsed: unknown = JSON.parse(new URL(page.url()).searchParams.get('filters') ?? '[]');
      return (typeof parsed === 'string' ? JSON.parse(parsed) : parsed) as Array<{
        fieldId: string;
        op: string;
        value?: unknown;
      }>;
    };
    const selectedTypes = readFilters().filter(
      (condition: { fieldId: string }) => condition.fieldId === '_schemaId'
    );
    expect(selectedTypes).toHaveLength(2);

    await page.reload();
    await expect(entitiesPage.facetCheckbox(apiSchema.name)).toBeChecked();
    await expect(entitiesPage.facetCheckbox(componentSchema.name)).toBeChecked();

    await page.getByTestId('entity-status-filter-Production').click();
    const combinedFilters = readFilters();
    expect(combinedFilters.filter(condition => condition.fieldId === '_schemaId')).toHaveLength(2);
    expect(combinedFilters).toContainEqual({
      fieldId: '_lifecycle',
      op: 'equals',
      value: expect.any(String)
    });

    await entitiesPage.typeFilter(apiSchema.name).click();
    await expect(entitiesPage.facetCheckbox(apiSchema.name)).not.toBeChecked();
    await expect(entitiesPage.facetCheckbox(componentSchema.name)).toBeChecked();

    await page.getByTestId('entity-filter-all').click();
    await expect(entitiesPage.browserTitle()).toHaveText('All entities');
    await expect(entitiesPage.facetCheckbox(componentSchema.name)).not.toBeChecked();
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

  test('shows filtered entities as graph roots and loads linked entities', async ({ page }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);

    await entitiesPage.goto({ viewMode: 'graph', q: frontendAppEntity.name });
    await expect(page).toHaveURL(/viewMode=graph/);
    await expect(entitiesPage.graphRootNodes()).toHaveCount(1);
    await expect.poll(async () => entitiesPage.graphNodes().count()).toBeGreaterThan(1);
  });

  test('persists the Capability + Entity + Project roadmap mode and horizon toggle', async ({
    page
  }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);

    await entitiesPage.goto({ viewMode: 'timeline' });
    await expect(page.getByText('Group', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hide horizon bands' })).toBeVisible();
    const groupSelect = page.getByText('Group', { exact: true }).locator('..').locator('select');
    await groupSelect.selectOption('owner');
    await expect(page.getByText('Horizon', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hide horizon bands' })).toBeVisible();
    await groupSelect.selectOption('capability');

    await expect(page.getByText('Horizon', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hide horizon bands' })).toBeVisible();
    await expect(page).toHaveURL(/viewConfigs=.*capability/);

    await page.getByRole('button', { name: 'Hide horizon bands' }).click();
    await expect(page.getByRole('button', { name: 'Show horizon bands' })).toBeVisible();

    await page.reload();
    await expect(
      page.getByText('Group', { exact: true }).locator('..').locator('select')
    ).toHaveValue('capability');
    await expect(page.getByRole('button', { name: 'Show horizon bands' })).toBeVisible();
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

  test('browses normalized OpenAPI operations and keeps API filters shareable', async ({
    page
  }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);
    await entitiesPage.goto();
    await entitiesPage.expectLoaded();
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

  test('selects API sources and historical versions without conflating them', async ({ page }) => {
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);
    await entitiesPage.goto();

    const sourceARevision1 = await entitiesPage.seedApiSpecification(
      authApiEntity.id,
      {
        openapi: '3.1.0',
        info: { title: 'Auth API v1', version: '1.0.0' },
        paths: {
          '/source-a-v1': {
            get: {
              operationId: 'sourceAV1',
              responses: { '200': { description: 'ok' } }
            }
          }
        }
      },
      'source-a-v1'
    );
    await entitiesPage.seedApiSpecificationRevision(
      authApiEntity.id,
      sourceARevision1.artifactId,
      {
        openapi: '3.1.0',
        info: { title: 'Auth API v2', version: '2.0.0' },
        paths: {
          '/source-a-v2': {
            get: {
              operationId: 'sourceAV2',
              responses: { '200': { description: 'ok' } }
            }
          }
        }
      },
      'source-a-v2'
    );
    await entitiesPage.seedApiSpecification(
      authApiEntity.id,
      {
        openapi: '3.1.0',
        info: { title: 'Auth API alternate', version: '1.0.0' },
        paths: {
          '/source-b-v1': {
            get: {
              operationId: 'sourceBV1',
              responses: { '200': { description: 'ok' } }
            }
          }
        }
      },
      'source-b-v1'
    );

    await entitiesPage.goto();
    await entitiesPage.openApiCatalog(authApiEntity.name);

    await expect(
      page.getByRole('region', { name: 'API specification sources and versions' })
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /source-a-v1/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /source-a-v2/ })).toHaveCount(2);
    await expect(page.getByRole('button', { name: /source-b-v1/ })).toHaveCount(2);
    await expect(page.getByText('Select an API source')).toBeVisible();
    await expect(page.getByText('sourceAV1')).toHaveCount(0);
    await expect(page.getByText('sourceBV1')).toHaveCount(0);

    await page.getByRole('button', { name: /Historical .*source-a-v1/ }).click();
    await expect(page).toHaveURL(
      new RegExp(
        `apiArtifactId=${sourceARevision1.artifactId}.*apiRevisionId=${sourceARevision1.revisionId}`
      )
    );
    await expect(page.getByText('Historical · source-a-v1', { exact: false })).toBeVisible();
    await expect(page.getByText('sourceAV1')).toBeVisible();
    await expect(page.getByText('sourceAV2')).toHaveCount(0);
    await expect(page.getByText('sourceBV1')).toHaveCount(0);

    await page.reload();
    await expect(page.getByText('sourceAV1')).toBeVisible();
    await expect(page.getByText('Historical · source-a-v1', { exact: false })).toBeVisible();
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
    expect(csv).not.toContain(`${frontendAppEntity.id};`);
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
