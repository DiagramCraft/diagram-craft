import { expect, test } from '@playwright/test';
import { EntitiesPage } from '../pages/EntitiesPage';
import { HomePage } from '../pages/HomePage';
import { defaultWorkspace } from '../support/workspaces';

test('shows default workspace after login', async ({ page }) => {
  const homePage = new HomePage(page, defaultWorkspace.slug);

  await homePage.goto();
  await expect(page.getByRole('main').getByText(defaultWorkspace.name, { exact: true })).toBeVisible();
});

test('navigates to entity list', async ({ page }) => {
  const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);

  await entitiesPage.goto();
  await entitiesPage.workspaceShell.expectMainVisible();
});
