import { expect, type Page } from '@playwright/test';
import { workspaceEntitiesRoute } from '../support/routes';
import { WorkspacePage } from './WorkspacePage';

export class EntitiesPage extends WorkspacePage {
  constructor(page: Page, workspaceSlug: string) {
    super(page, workspaceSlug);
  }

  goto = async () => {
    await this.page.goto(workspaceEntitiesRoute(this.workspaceSlug));
  };

  expectLoaded = async () => {
    await this.workspaceShell.expectActiveNav('entities');
    await expect(this.page.getByRole('main').getByText('All entities')).toBeVisible();
    await expect(this.page.getByPlaceholder('Search by name, owner…')).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'New entity' })).toBeVisible();
  };
}
