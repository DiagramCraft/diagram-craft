import { expect } from '@playwright/test';
import { workspaceEntitiesRoute } from '../support/routes';
import { WorkspacePage } from './WorkspacePage';

export class EntitiesPage extends WorkspacePage {
  goto = async (search?: Record<string, string | undefined>) => {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(search ?? {})) {
      if (value != null && value !== '') {
        query.set(key, value);
      }
    }

    const path = workspaceEntitiesRoute(this.workspaceSlug);
    await this.page.goto(query.size > 0 ? `${path}?${query.toString()}` : path);
  };

  typeFilter = (name: string) => this.page.getByTestId(`entity-type-filter-${name}`);
  browserTitle = () => this.page.getByTestId('entity-browser-title');
  browserCount = () => this.page.getByTestId('entity-browser-count');
  entityRow = (name: string) => this.page.getByRole('row', { name: `Entity row: ${name}` });

  expectLoaded = async () => {
    await this.workspaceShell.expectActiveNav('entities');
    await expect(this.page.getByRole('main').getByText('All entities')).toBeVisible();
    await expect(this.page.getByPlaceholder('Search by name, owner…')).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'New entity' })).toBeVisible();
  };

  filterByType = async (name: string) => {
    await this.typeFilter(name).click();
    await expect(this.browserTitle()).toHaveText(name);
  };

  switchView = async (view: 'table' | 'cards' | 'tree') => {
    await this.goto({ viewMode: view });
    await expect(this.browserTitle()).toBeVisible();
  };

  expectFilteredResultCount = async (count: number) => {
    await expect(this.browserCount()).toHaveText(String(count));
  };

  openExportMenu = async () => {
    await this.page.getByRole('button', { name: 'Entity browser actions' }).click();
  };

  exportCsv = async () => {
    await this.openExportMenu();
    await this.page.getByRole('menuitem', { name: 'Export CSV' }).click();
  };

  openNewEntityDialog = async () => {
    await this.page.getByRole('button', { name: 'New entity' }).click();
    await expect(this.page.getByRole('alertdialog', { name: 'New entity' })).toBeVisible();
  };

  openEntity = async (name: string) => {
    await this.entityRow(name).click();
    await expect(this.page.getByRole('heading', { name })).toBeVisible();
  };

  openApiCatalog = async (name: string) => {
    await this.openEntity(name);
    await this.page.getByTestId('entity-api-tab').click();
    await expect(this.page).toHaveURL(/tab=api/);
  };

  seedApiSpecification = async (entityId: string, content: Record<string, unknown>) => {
    const baseUrl = new URL(
      `/api/application/v1/${this.workspaceSlug}/entities/${entityId}/artifacts`,
      this.page.url()
    ).toString();
    const artifactResponse = await this.page.request.post(baseUrl, {
      data: {
        artifactType: 'api-specification',
        kind: 'document',
        mediaType: 'application/json'
      }
    });
    expect(artifactResponse.ok()).toBe(true);
    const artifact = (await artifactResponse.json()) as { id: string };
    const revisionResponse = await this.page.request.post(`${baseUrl}/${artifact.id}/revisions`, {
      data: {
        mediaType: 'application/json',
        sourceRevision: `ui-${Date.now()}`,
        content: JSON.stringify(content)
      }
    });
    expect(revisionResponse.ok()).toBe(true);
  };

  expectEntityDetailLoaded = async (name: string) => {
    await expect(this.page.getByRole('heading', { name })).toBeVisible();
    await expect(this.page.getByRole('tab', { name: 'Overview' })).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Edit' })).toBeVisible();
  };

  startEditingEntity = async () => {
    await this.page.getByRole('button', { name: 'Edit' }).click();
    await expect(this.page.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  };

  openEntityActions = async () => {
    await this.page.getByRole('button', { name: 'Entity actions' }).click();
    await expect(this.page.getByRole('menu')).toBeVisible();
  };

  openEntityJsonDialog = async () => {
    await this.openEntityActions();
    await this.page.getByRole('menuitem', { name: 'View JSON' }).click();
    await expect(
      this.page.getByRole('alertdialog', { name: 'Entity JSON (depth 1)' })
    ).toBeVisible();
  };

  openCollectionsDialog = async () => {
    await this.openEntityActions();
    await this.page.getByRole('menuitem', { name: 'Collections…' }).click();
    await expect(this.page.getByRole('alertdialog', { name: 'Manage collections' })).toBeVisible();
  };
}
