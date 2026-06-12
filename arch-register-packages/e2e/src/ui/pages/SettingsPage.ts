import { expect, } from '@playwright/test';
import { workspaceSettingsRoute } from '../support/routes';
import { WorkspacePage } from './WorkspacePage';

export class SettingsPage extends WorkspacePage {

  goto = async () => {
    await this.page.goto(workspaceSettingsRoute(this.workspaceSlug));
  };

  expectLoaded = async () => {
    await expect(this.page.getByText('Workspace settings')).toBeVisible();
    await expect(this.page.getByRole('main').getByText('General')).toBeVisible();
    await expect(this.page.getByText('Workspace name')).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Save changes' })).toBeVisible();
  };
}
