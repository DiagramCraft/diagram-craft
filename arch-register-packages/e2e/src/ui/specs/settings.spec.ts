import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { DataModelPage } from '../pages/DataModelPage';
import { HomePage } from '../pages/HomePage';
import { SettingsPage } from '../pages/SettingsPage';
import { defaultWorkspace } from '../support/workspaces';

test.describe('settings section', () => {
  test('shows workspace settings @quick', async ({ page }) => {
    const settingsPage = new SettingsPage(page, defaultWorkspace.slug);

    await settingsPage.goto();
    await settingsPage.expectLoaded();
  });

  test('opens the data model from workspace home through workspace settings', async ({ page }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);
    const dataModelPage = new DataModelPage(page, defaultWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(defaultWorkspace.name);
    await homePage.workspaceShell.topBar.hamburgerButton().click();
    await page.getByRole('menuitem', { name: 'Workspace settings', exact: true }).click();
    await page.getByText('Entity Schema', { exact: true }).click();
    await dataModelPage.expectLoaded();
  });

  test('shows capability binding tabs', async ({ page }) => {
    const settingsPage = new SettingsPage(page, defaultWorkspace.slug);

    await settingsPage.goto('capabilities');
    await expect(page.getByRole('tab', { name: 'API Specification', exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Enabled', exact: true })).toBeChecked();
    await expect(page.getByText('API entity schema', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Disable capability', exact: true })).toHaveCount(
      0
    );
  });
});
