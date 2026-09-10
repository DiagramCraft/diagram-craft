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

  test('shows a capability binding from the Applications & Capabilities sidebar', async ({
    page
  }) => {
    const settingsPage = new SettingsPage(page, defaultWorkspace.slug);

    await settingsPage.goto('applications-capabilities');
    await page.getByText('API specification', { exact: true }).click();
    // A capability detail view still renders a Tabs component even with a single tab.
    await expect(page.getByRole('tab', { name: 'Binding', exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Enabled', exact: true })
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('API entity schema', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeVisible();
  });

  test('groups applications with binding and access tabs', async ({ page }) => {
    const settingsPage = new SettingsPage(page, defaultWorkspace.slug);

    await settingsPage.goto('applications-capabilities');
    await page.getByText('Strategy & Capability Modelling', { exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Bindings', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Fields', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Dashboard', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Access', exact: true })).toBeVisible();

    await page.getByRole('tab', { name: 'Access', exact: true }).click();
    await expect(
      page.getByRole('checkbox', { name: 'All workspace members', exact: true })
    ).toBeVisible();
  });
});
