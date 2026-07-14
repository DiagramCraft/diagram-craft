import { expect, test } from '@playwright/test';
import { EntitiesPage } from '../pages/EntitiesPage';
import { HomePage } from '../pages/HomePage';
import { SearchPage } from '../pages/SearchPage';
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

test('restores workspace content filter and view mode through reload and browser history', async ({ page }) => {
  await page.goto(`/${defaultWorkspace.slug}/content`);

  const filterInput = page.getByPlaceholder('Filter diagrams…');
  const listViewButton = page.locator('button[title="List view"]');

  await filterInput.fill('Arch');
  await expect(page).toHaveURL(/contentQuery=Arch/);

  await listViewButton.click();
  await expect(page).toHaveURL(/contentView=list/);
  await expect(page.getByText('Name')).toBeVisible();

  await filterInput.fill('Architecture');
  await expect(page).toHaveURL(/contentQuery=Architecture/);

  await page.reload();
  await expect(filterInput).toHaveValue('Architecture');
  await expect(page.getByText('Name')).toBeVisible();

  await page.goBack();
  await expect(filterInput).toHaveValue('Arch');
  await expect(page).not.toHaveURL(/contentView=list/);
  await expect(page.getByText('Name')).toHaveCount(0);

  await page.goForward();
  await expect(filterInput).toHaveValue('Architecture');
  await expect(page).toHaveURL(/contentView=list/);
  await expect(page.getByText('Name')).toBeVisible();
});

test('navigates directly to workspace content folders, including nested folders', async ({ page }) => {
  await page.goto(`/${defaultWorkspace.slug}/content/folders/wiki?contentQuery=Home&contentView=list`);

  await expect(page).toHaveURL(/\/content\/folders\/wiki\?contentQuery=Home&contentView=list/);
  await expect(page.getByPlaceholder('Filter diagrams…')).toHaveValue('Home');
  await expect(page.getByText('Name')).toBeVisible();

  await page.goto(`/${defaultWorkspace.slug}/content/folders/docs/guides`);

  await expect(page).toHaveURL(/\/content\/folders\/docs\/guides$/);
  await expect(page.getByText('No content here')).toBeVisible();
});

test.describe('workspace rail navigation', () => {
  test('navigates to entities from workspace home through the rail @quick', async ({ page }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(defaultWorkspace.name);
    await entitiesPage.workspaceShell.openNav('entities');
    await entitiesPage.expectLoaded();
  });

  test('navigates to search from workspace home through the rail @quick', async ({ page }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);
    const searchPage = new SearchPage(page, defaultWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(defaultWorkspace.name);
    await searchPage.workspaceShell.openNav('search');
    await searchPage.expectLoaded();
  });
});
