import { expect } from '@playwright/test';
import { workspaceSettingsRoute } from '../support/routes';
import { WorkspacePage } from './WorkspacePage';

export class SettingsPage extends WorkspacePage {
  goto = async (section?: string) => {
    await this.page.goto(workspaceSettingsRoute(this.workspaceSlug, section));
  };

  expectLoaded = async () => {
    await expect(this.page.getByText('Settings').first()).toBeVisible();
    await expect(this.page.getByRole('main').getByText('General')).toBeVisible();
    await expect(this.page.getByText('Workspace name')).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Save changes' })).toBeVisible();
  };
}
