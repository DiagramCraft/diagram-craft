import { expect, type Locator, type Page } from '@playwright/test';

type WorkspaceSummary = {
  name: string;
  slug: string;
};

type CreateWorkspaceInput = {
  name: string;
  description?: string;
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

  searchInput = (): Locator => this.page.getByPlaceholder('Search entities, diagrams, projects...');

  signOutMenuItem = (): Locator => this.page.getByRole('menuitem', { name: 'Sign out' });

  accountMenu = (): Locator => this.page.getByTestId('account-menu-content');

  workspaceMenuLabel = (): Locator => this.page.getByText('Workspaces', { exact: true });

  workspaceMenu = (): Locator => this.workspaceMenuLabel().locator('..');

  workspaceMenuItem = (workspaceName: string): Locator =>
    this.workspaceMenu().getByRole('button').filter({ hasText: workspaceName });

  newWorkspaceMenuItem = (): Locator =>
    this.workspaceMenu().getByRole('button', { name: 'New workspace...' });

  addWorkspaceDialog = (): Locator =>
    this.page.getByRole('alertdialog', { name: 'Create a workspace' });

  createWorkspaceButton = (): Locator =>
    this.page.getByRole('button', { name: 'Create workspace' });

  notificationsButton = (): Locator => this.page.locator('button[aria-label="Notifications"]');

  notificationsTab = (): Locator => this.page.getByRole('tab', { name: /^Notifications/ });

  watchingTab = (): Locator => this.page.getByRole('tab', { name: 'Watching' });

  markAllReadButton = (): Locator => this.page.getByRole('button', { name: 'Mark all read' });

  notificationRows = (): Locator => this.page.locator('[aria-label^="Notification: "]');

  watchingRows = (): Locator => this.page.locator('[aria-label^="Watching: "]');

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
    await expect(this.accountMenu().getByText(displayName, { exact: true })).toBeVisible();
    await expect(this.accountMenu().getByText(email, { exact: true })).toBeVisible();
    await this.page.keyboard.press('Escape');
    await expect(this.signOutMenuItem()).toBeHidden();
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
    await expect(this.workspaceMenuItem(currentWorkspace.name)).toBeVisible();
    await expect(this.workspaceMenuItem(targetWorkspace.name)).toBeVisible();
  };

  switchWorkspace = async (workspace: WorkspaceSummary) => {
    await this.openWorkspaceSwitcher();
    await this.workspaceMenuItem(workspace.name).click();
    await expect(this.page).toHaveURL(new RegExp(`/${workspace.slug}$`));
    await expect(this.workspaceSelectorButton()).toContainText(workspace.name);
  };

  openAddWorkspaceFromSwitcher = async () => {
    await this.openWorkspaceSwitcher();
    await this.newWorkspaceMenuItem().click();
    await expect(this.addWorkspaceDialog()).toBeVisible();
  };

  createBlankWorkspace = async ({ name, description }: CreateWorkspaceInput) => {
    const dialog = this.addWorkspaceDialog();

    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder('e.g. Acme Payments Platform').fill(name);
    if (description != null) {
      await dialog.locator('textarea').fill(description);
    }
    await this.createWorkspaceButton().click();
  };

  signOut = async () => {
    await this.openAccountMenu();
    await this.signOutMenuItem().click();
    await expect(this.page).toHaveURL(/\/login/);
  };

  search = async (query: string) => {
    await this.searchInput().fill(query);
    await this.searchInput().press('Enter');
  };

  openNotificationsMenu = async () => {
    if (!(await this.notificationsTab().isVisible())) {
      await this.notificationsButton().click();
    }
    await expect(this.notificationsTab()).toBeVisible();
  };

  expectUnreadNotificationCount = async (count: number) => {
    await expect(this.notificationsButton()).toContainText(String(count));
  };

  expectNotificationItemCount = async (count: number) => {
    await this.openNotificationsMenu();
    await expect(this.notificationRows()).toHaveCount(count);
  };

  clearNotification = async (entityName: string, remainingCount: number) => {
    await this.openNotificationsMenu();
    await this.page.locator(`[aria-label="Clear notification for ${entityName}"]`).click();
    await expect(this.notificationRows()).toHaveCount(remainingCount);
    if (remainingCount > 0) {
      await expect(this.notificationsButton()).toContainText(String(remainingCount));
    } else {
      await expect(this.notificationsButton()).not.toContainText(/[1-9]/);
    }
  };

  clearAllNotifications = async () => {
    await this.openNotificationsMenu();
    await this.markAllReadButton().click();
    await expect(this.notificationRows()).toHaveCount(0);
    await expect(this.page.getByText('No notifications yet', { exact: true })).toBeVisible();
    await expect(this.notificationsButton()).not.toContainText(/[1-9]/);
  };

  openWatchingTab = async () => {
    await this.openNotificationsMenu();
    await this.watchingTab().click();
    await expect(this.watchingTab()).toHaveAttribute('aria-selected', 'true');
  };

  expectWatchingItemCount = async (count: number) => {
    await this.openWatchingTab();
    await expect(this.watchingRows()).toHaveCount(count);
  };

  unwatchEntity = async (entityName: string, remainingCount: number) => {
    await this.openWatchingTab();
    await this.page.locator(`[aria-label="Unwatch ${entityName}"]`).click();
    await expect(this.watchingRows()).toHaveCount(remainingCount);
  };
}
