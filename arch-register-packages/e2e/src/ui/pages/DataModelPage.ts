import { expect } from '@playwright/test';
import { workspaceModelRoute } from '../support/routes';
import { WorkspacePage } from './WorkspacePage';

export class DataModelPage extends WorkspacePage {
  goto = async () => {
    await this.page.goto(workspaceModelRoute(this.workspaceSlug));
  };

  anySchemaTypeRow = () => this.page.locator('[data-testid^="schema-type-"]').first();
  schemaTypeRow = (name: string) => this.page.getByTestId(`schema-type-${name}`);
  editorTitle = () => this.page.getByTestId('schema-editor-title');

  nameInput = () => this.page.getByText('Name', { exact: true }).locator('..').locator('input');
  keyPrefixInput = () =>
    this.page.getByText('Key Prefix', { exact: true }).locator('..').locator('input');

  expectLoaded = async () => {
    await this.workspaceShell.expectMainVisible();
    await expect(this.anySchemaTypeRow()).toBeVisible();
    await expect(this.page.getByRole('main').getByText('No type selected')).toBeVisible();
    await expect(
      this.page
        .getByRole('main')
        .getByText('Select an entity type from the sidebar to edit its schema.')
    ).toBeVisible();
    await expect(this.page.getByRole('button', { name: 'New entity type' })).toBeVisible();
  };

  openSchemaType = async (name: string) => {
    await this.schemaTypeRow(name).click();
    await expect(this.editorTitle()).toHaveText(name);
  };

  createNewEntityType = async () => {
    const name = `E2E Entity Type ${Date.now()}`;

    await this.page.getByRole('button', { name: 'New entity type' }).click();

    await this.nameInput().fill(name);
    await this.keyPrefixInput().fill('UIT');
    await this.page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(this.schemaTypeRow(name)).toBeVisible();
    await expect(this.editorTitle()).toHaveText(name);

    return name;
  };

  deleteSelectedEntityType = async () => {
    const deleteButton = this.page.getByRole('button', { name: 'Delete type' });
    if ((await deleteButton.count()) === 0) return;

    const deletedName = await this.editorTitle().textContent();
    await deleteButton.click();
    await this.page.getByRole('alertdialog').getByRole('button', { name: 'Delete type' }).click();
    if (deletedName) {
      await expect(this.schemaTypeRow(deletedName)).toHaveCount(0);
      await expect(this.editorTitle()).not.toHaveText(deletedName);
    }
  };
}
