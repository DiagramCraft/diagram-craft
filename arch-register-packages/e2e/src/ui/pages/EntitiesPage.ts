import { expect, } from '@playwright/test';
import { workspaceEntitiesRoute } from '../support/routes';
import { WorkspacePage } from './WorkspacePage';

export class EntitiesPage extends WorkspacePage {

  goto = async () => {
    await this.page.goto(workspaceEntitiesRoute(this.workspaceSlug));
  };

  typeFilter = (name: string) => this.page.getByTestId(`entity-type-filter-${name}`);
  browserTitle = () => this.page.getByTestId('entity-browser-title');
  browserCount = () => this.page.getByTestId('entity-browser-count');

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
}
