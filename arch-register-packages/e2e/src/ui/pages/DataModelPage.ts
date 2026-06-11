import { expect, type Page } from '@playwright/test';
import { workspaceModelRoute } from '../support/routes';
import { WorkspacePage } from './WorkspacePage';

export class DataModelPage extends WorkspacePage {
  constructor(page: Page, workspaceSlug: string) {
    super(page, workspaceSlug);
  }

  goto = async () => {
    await this.page.goto(workspaceModelRoute(this.workspaceSlug));
  };

  expectLoaded = async () => {
    await this.workspaceShell.expectActiveNav('model');
    await expect(this.page.getByText('Schema', { exact: true })).toBeVisible();
    await expect(
      this.page.getByText('Define the entity types that everything in this workspace conforms to.')
    ).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'New entity type' })).toBeVisible();
  };
}
