import { test } from '@playwright/test';
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
    await page.getByText('Schemas', { exact: true }).click();
    await dataModelPage.expectLoaded();
  });
});
