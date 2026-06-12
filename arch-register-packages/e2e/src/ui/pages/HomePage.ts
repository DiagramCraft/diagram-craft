import { expect, } from '@playwright/test';
import { workspaceHomeRoute } from '../support/routes';
import { WorkspacePage } from './WorkspacePage';

export class HomePage extends WorkspacePage {

  goto = async () => {
    await this.page.goto(workspaceHomeRoute(this.workspaceSlug));
  };

  expectLoaded = async (workspaceName: string) => {
    await this.workspaceShell.expectActiveNav('home');
    await this.workspaceShell.expectMainVisible();
    await expect(this.page.getByRole('main').getByText(workspaceName, { exact: true })).toBeVisible();
    await expect(this.page.getByText('Entities').first()).toBeVisible();
    await expect(this.page.getByText('Projects').first()).toBeVisible();
  };

  expectProjectVisible = async (name: string) => {
    await expect(this.page.getByRole('main').getByText(name, { exact: true })).toBeVisible();
  };

  openNewProjectDialog = async () => {
    await this.page.getByRole('button', { name: 'New project' }).click();
    await expect(this.page.getByRole('alertdialog', { name: 'New project' })).toBeVisible();
  };

  openNewEntityDialog = async () => {
    await this.page.getByRole('button', { name: 'New entity' }).click();
    await expect(this.page.getByRole('alertdialog', { name: 'New entity' })).toBeVisible();
  };

  openProject = async (name: string) => {
    await this.page.getByRole('button', { name }).click();
  };
}
