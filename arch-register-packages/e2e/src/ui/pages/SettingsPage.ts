import { expect, } from '@playwright/test';
import { workspaceSettingsRoute } from '../support/routes';
import { WorkspacePage } from './WorkspacePage';

export class SettingsPage extends WorkspacePage {

  goto = async (section?: string) => {
    const route = workspaceSettingsRoute(this.workspaceSlug);
    await this.page.goto(section == null ? route : `${route}?section=${section}`);
  };

  expectLoaded = async () => {
    await expect(this.page.getByText('Settings').first()).toBeVisible();
    await expect(this.page.getByRole('main').getByText('General')).toBeVisible();
    await expect(this.page.getByText('Workspace name')).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'Save changes' })).toBeVisible();
  };
}
