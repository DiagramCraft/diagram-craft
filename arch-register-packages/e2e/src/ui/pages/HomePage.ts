import { expect } from '@playwright/test';
import { workspaceHomeRoute } from '../support/routes';
import { WorkspacePage } from './WorkspacePage';

export class HomePage extends WorkspacePage {
  goto = async () => {
    await this.gotoAuthenticated(workspaceHomeRoute(this.workspaceSlug));
  };

  expectLoaded = async (workspaceName: string) => {
    await this.workspaceShell.expectActiveNav('home');
    await this.workspaceShell.expectMainVisible();
    await expect(this.workspaceShell.topBar.workspaceSelectorButton()).toContainText(workspaceName);
    await expect(this.page.getByText('Entities').first()).toBeVisible();
    await expect(this.page.getByText('Projects').first()).toBeVisible();
  };

  newMenuButton = () => this.page.getByRole('button', { name: 'New', exact: true });

  openNewProjectDialog = async () => {
    await this.newMenuButton().click();
    await this.page.getByRole('menuitem', { name: 'New project' }).click();
    await expect(this.page.getByRole('alertdialog', { name: 'New project' })).toBeVisible();
  };

  openNewEntityDialog = async () => {
    await this.newMenuButton().click();
    await this.page.getByRole('menuitem', { name: 'New entity' }).click();
    await expect(this.page.getByRole('alertdialog', { name: 'New entity' })).toBeVisible();
  };

  editDashboardButton = () => this.page.getByRole('button', { name: 'Edit', exact: true });

  addWidgetButton = () =>
    this.page.getByRole('main').getByRole('button', { name: 'Add widget', exact: true });

  saveDashboardButton = () =>
    this.page.getByRole('main').getByRole('button', { name: 'Save', exact: true });

  cancelDashboardButton = () =>
    this.page.getByRole('main').getByRole('button', { name: 'Cancel', exact: true });

  enterEditMode = async () => {
    await this.editDashboardButton().click();
  };

  expectEditModeAvailable = async () => {
    await expect(this.editDashboardButton()).toBeVisible();
  };

  expectReadOnly = async () => {
    await expect(this.editDashboardButton()).toHaveCount(0);
  };

  saveDashboard = async () => {
    await this.saveDashboardButton().click();
  };

  dashboardRow = (name: string) => this.page.getByTestId(`dashboard-row-${name}`);

  switchDashboard = async (name: string) => {
    await this.dashboardRow(name).click();
  };

  dashboardRowContextMenu = async (name: string) => {
    await this.dashboardRow(name).click({ button: 'right' });
  };

  openNewDashboardMenu = async () => {
    await this.newMenuButton().click();
    await this.page.getByRole('menuitem', { name: 'New dashboard' }).click();
  };

  createDashboard = async (name: string) => {
    await this.openNewDashboardMenu();
    const dialog = this.page.getByRole('alertdialog', { name: 'New dashboard' });
    await dialog.getByPlaceholder('e.g. Security posture').fill(name);
    await dialog.getByRole('button', { name: 'Create dashboard' }).click();
  };

  renameDashboard = async (currentName: string, newName: string) => {
    await this.dashboardRowContextMenu(currentName);
    await this.page.getByRole('menuitem', { name: 'Rename' }).click();
    const dialog = this.page.getByRole('alertdialog', { name: 'Rename dashboard' });
    await dialog.getByPlaceholder('e.g. Security posture').fill(newName);
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  };

  deleteDashboard = async (name: string) => {
    await this.dashboardRowContextMenu(name);
    await this.page.getByRole('menuitem', { name: 'Delete' }).click();
    await this.page
      .getByRole('alertdialog', { name: 'Delete dashboard?' })
      .getByRole('button', { name: 'Delete dashboard' })
      .click();
  };
}
