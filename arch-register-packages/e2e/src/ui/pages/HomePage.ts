import { expect } from '@playwright/test';
import { workspaceHomeRoute } from '../support/routes';
import { WorkspacePage } from './WorkspacePage';

export class HomePage extends WorkspacePage {
  goto = async () => {
    await this.page.goto(workspaceHomeRoute(this.workspaceSlug));
  };

  expectLoaded = async (workspaceName: string) => {
    await this.workspaceShell.expectActiveNav('home');
    await this.workspaceShell.expectMainVisible();
    await expect(this.workspaceShell.topBar.workspaceSelectorButton()).toContainText(workspaceName);
    await expect(this.page.getByText('Entities').first()).toBeVisible();
    await expect(this.page.getByText('Projects').first()).toBeVisible();
  };

  openNewProjectDialog = async () => {
    await this.page.getByRole('button', { name: 'New project' }).click();
    await expect(this.page.getByRole('alertdialog', { name: 'New project' })).toBeVisible();
  };

  openNewEntityDialog = async () => {
    await this.page.getByRole('button', { name: 'New entity' }).click();
    await expect(this.page.getByRole('alertdialog', { name: 'New entity' })).toBeVisible();
  };

  editDashboardButton = () => this.page.getByRole('button', { name: 'Edit dashboard' });

  addWidgetButton = () => this.page.getByRole('button', { name: 'Add widget' });

  saveDashboardButton = () => this.page.getByRole('button', { name: 'Save' });

  cancelDashboardButton = () => this.page.getByRole('button', { name: 'Cancel' });

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
}
