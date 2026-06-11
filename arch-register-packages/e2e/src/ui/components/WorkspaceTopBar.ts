import { expect, type Locator, type Page } from '@playwright/test';

type WorkspaceSummary = {
  name: string;
  slug: string;
};

export class WorkspaceTopBar {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  hamburgerButton = (): Locator => this.page.getByRole('button', { name: 'Open application menu' });

  workspaceSelectorButton = (): Locator =>
    this.page.getByRole('button', { name: 'Workspace selector' });

  accountMenuButton = (): Locator => this.page.getByRole('button', { name: 'Account menu' });

  signOutMenuItem = (): Locator => this.page.getByRole('menuitem', { name: 'Sign out' });

  workspaceMenuLabel = (): Locator => this.page.getByText('Workspaces', { exact: true });

  expectHamburgerVisible = async () => {
    await expect(this.hamburgerButton()).toBeVisible();
  };

  openAccountMenu = async () => {
    if (!(await this.signOutMenuItem().isVisible())) {
      await this.accountMenuButton().click();
    }
    await expect(this.signOutMenuItem()).toBeVisible();
  };

  expectAccountMenuVisible = async (displayName: string, email: string) => {
    await this.openAccountMenu();
    await expect(this.page.getByText(displayName, { exact: true })).toBeVisible();
    await expect(this.page.getByText(email, { exact: true })).toBeVisible();
  };

  openWorkspaceSwitcher = async () => {
    if (!(await this.workspaceMenuLabel().isVisible())) {
      await this.workspaceSelectorButton().click();
    }
    await expect(this.workspaceMenuLabel()).toBeVisible();
  };

  expectWorkspaceSwitcherVisible = async (
    currentWorkspace: WorkspaceSummary,
    targetWorkspace: WorkspaceSummary
  ) => {
    await expect(this.workspaceSelectorButton()).toContainText(currentWorkspace.name);
    await this.openWorkspaceSwitcher();
    await expect(this.page.getByRole('button', { name: new RegExp(currentWorkspace.name) })).toBeVisible();
    await expect(this.page.getByRole('button', { name: new RegExp(targetWorkspace.name) })).toBeVisible();
  };

  switchWorkspace = async (workspace: WorkspaceSummary) => {
    await this.openWorkspaceSwitcher();
    await this.page.getByRole('button', { name: new RegExp(workspace.name) }).click();
    await expect(this.page).toHaveURL(new RegExp(`/${workspace.slug}$`));
    await expect(this.workspaceSelectorButton()).toContainText(workspace.name);
  };

  signOut = async () => {
    await this.openAccountMenu();
    await this.signOutMenuItem().click();
    await expect(this.page).toHaveURL(/\/login/);
  };
}
