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

  test('runs an entity query from the query console', async ({ page }) => {
    const settingsPage = new SettingsPage(page, defaultWorkspace.slug);

    await settingsPage.goto('query-console');
    await expect(page.getByRole('heading', { name: 'Query Console', exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Query text', exact: true }).fill('schema:Component');
    await page.getByRole('button', { name: 'Run query', exact: true }).click();

    await expect(page.getByText(/record\(s\) returned/)).toBeVisible();
    await expect(page.locator('pre')).toContainText('"_uid"');
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

  test('lists applications with an access tab', async ({ page }) => {
    const settingsPage = new SettingsPage(page, defaultWorkspace.slug);

    await settingsPage.goto('applications-capabilities');
    await page.getByText('Strategy & Capability Modelling', { exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Access', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Binding', exact: true })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Bindings', exact: true })).toHaveCount(0);

    await page.getByRole('tab', { name: 'Access', exact: true }).click();
    await expect(
      page.getByRole('checkbox', { name: 'All workspace members', exact: true })
    ).toBeVisible();
  });
});
