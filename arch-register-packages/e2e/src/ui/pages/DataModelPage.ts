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

  schemaTypeRow = (name: string) => this.page.getByLabel(`Schema type: ${name}`);
  editorTitle = () => this.page.getByLabel('Schema editor title');

  expectLoaded = async () => {
    await this.workspaceShell.expectActiveNav('model');
    await expect(this.page.getByText('Schema', { exact: true })).toBeVisible();
    await expect(
      this.page.getByText('Define the entity types that everything in this workspace conforms to.')
    ).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'New entity type' })).toBeVisible();
  };

  openSchemaType = async (name: string) => {
    await this.schemaTypeRow(name).click();
    await expect(this.editorTitle()).toHaveText(name);
  };

  createNewEntityType = async () => {
    await this.page.getByRole('button', { name: 'New entity type' }).click();
    await expect(this.editorTitle()).toHaveText('New type');
  };

  deleteSelectedEntityType = async () => {
    const deletedName = await this.editorTitle().textContent();
    await this.page.getByRole('button', { name: 'Delete type' }).click();
    await this.page.getByRole('alertdialog').getByRole('button', { name: 'Delete type' }).click();
    if (deletedName) {
      await expect(this.schemaTypeRow(deletedName)).toHaveCount(0);
      await expect(this.editorTitle()).not.toHaveText(deletedName);
    }
  };
}
