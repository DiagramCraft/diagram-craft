import { expect, type Locator } from '@playwright/test';
import { accountSettingsRoute } from '../support/routes';
import { WorkspacePage } from './WorkspacePage';

export class AccountSettingsPage extends WorkspacePage {
  goto = async (section: 'profile' | 'appearance' = 'profile') => {
    await this.page.goto(accountSettingsRoute(this.workspaceSlug, section));
  };

  displayNameInput = (): Locator => this.page.getByLabel('Display name');

  saveChangesButton = (): Locator =>
    this.page.getByRole('button', { name: /Save changes|Saving…/ });

  colorSwatch = (color: string): Locator =>
    this.page.getByRole('button', { name: `Select color ${color}` });

  expectProfileLoaded = async () => {
    await expect(this.page.getByText('Account settings', { exact: true })).toBeVisible();
    await expect(this.displayNameInput()).toBeVisible();
    await expect(this.page.getByText('Authentication Provider', { exact: true })).toBeVisible();
  };

  expectAppearanceLoaded = async () => {
    await expect(this.page.getByText('Account settings', { exact: true })).toBeVisible();
    await expect(
      this.page.getByRole('main').getByText('Avatar Color', { exact: true })
    ).toBeVisible();
    await expect(this.page.getByTestId('account-avatar-preview')).toBeVisible();
  };

  changeDisplayName = async (displayName: string) => {
    await this.displayNameInput().fill(displayName);
  };

  selectColor = async (color: string) => {
    await this.colorSwatch(color).click();
  };

  saveChanges = async () => {
    await this.saveChangesButton().click();
    // The button is disabled again once the saved values are reloaded
    await expect(this.saveChangesButton()).toBeDisabled();
  };
}
