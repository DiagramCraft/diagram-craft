import { test } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { SearchPage } from '../pages/SearchPage';
import { authApiEntity, customerApiEntity } from '../support/entities';
import { seededUser } from '../support/users';
import { defaultWorkspace, secondWorkspace } from '../support/workspaces';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

test.describe('topbar', () => {
  test('shows the hamburger menu trigger', async ({ page }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(defaultWorkspace.name);
    await homePage.workspaceShell.topBar.expectHamburgerVisible();
  });

  test('shows the account popup with the current user name', async ({ page }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(defaultWorkspace.name);
    await homePage.workspaceShell.topBar.expectAccountMenuVisible(
      seededUser.displayName,
      seededUser.email
    );
  });

  test('opens the workspace selector and switches workspace', async ({ page }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);
    const secondHomePage = new HomePage(page, secondWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(defaultWorkspace.name);
    await homePage.workspaceShell.topBar.expectWorkspaceSwitcherVisible(
      defaultWorkspace,
      secondWorkspace
    );
    await homePage.workspaceShell.topBar.switchWorkspace(secondWorkspace);
    await secondHomePage.expectLoaded(secondWorkspace.name);
  });

  test('creates a new workspace from the workspace selector', async ({ page }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);
    const workspaceName = `Topbar Workspace ${Date.now()}`;
    const workspaceSlug = slugify(workspaceName);
    const newHomePage = new HomePage(page, workspaceSlug);

    await homePage.goto();
    await homePage.expectLoaded(defaultWorkspace.name);
    await homePage.workspaceShell.topBar.openAddWorkspaceFromSwitcher();
    await homePage.workspaceShell.topBar.createBlankWorkspace({ name: workspaceName });
    await newHomePage.expectLoaded(workspaceName);
    await homePage.workspaceShell.topBar.expectWorkspaceSwitcherVisible(
      { name: workspaceName, slug: workspaceSlug },
      defaultWorkspace
    );
    await page.keyboard.press('Escape');
  });

  test('searches from the topbar', async ({ page }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);
    const searchPage = new SearchPage(page, defaultWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(defaultWorkspace.name);
    await homePage.workspaceShell.topBar.search('API');
    await searchPage.expectLoaded({ empty: false });
    await searchPage.expectSearchQuery('API');
    await searchPage.expectEntityResultCount(3);
    await searchPage.expectResultVisible(customerApiEntity.name);
    await searchPage.expectResultVisible(authApiEntity.name);
  });

  test('signs out from the account popup', async ({ page }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);
    const loginPage = new LoginPage(page);

    await homePage.goto();
    await homePage.expectLoaded(defaultWorkspace.name);
    await homePage.workspaceShell.topBar.signOut();
    await loginPage.expectLoaded();
  });
});
