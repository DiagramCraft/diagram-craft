import { expect } from '@playwright/test';
import { test } from '../fixtures';
import { HomePage } from '../pages/HomePage';
import { defaultWorkspace } from '../support/workspaces';

test.describe('home section', () => {
  test('shows workspace dashboard overview @quick', async ({ page }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(defaultWorkspace.name);
    await expect(page.getByText('Architecture', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Data', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Technology', { exact: true }).first()).toBeVisible();
  });

  test('opens the new project dialog', async ({ page }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(defaultWorkspace.name);
    await homePage.openNewProjectDialog();
  });

  test('opens the new entity dialog', async ({ page }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(defaultWorkspace.name);
    await homePage.openNewEntityDialog();
  });
});
