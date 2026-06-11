import { test } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { seededUser } from '../support/users';
import { defaultWorkspace, secondWorkspace } from '../support/workspaces';

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

  test('signs out from the account popup', async ({ page }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);
    const loginPage = new LoginPage(page);

    await homePage.goto();
    await homePage.expectLoaded(defaultWorkspace.name);
    await homePage.workspaceShell.topBar.signOut();
    await loginPage.expectLoaded();
  });
});
