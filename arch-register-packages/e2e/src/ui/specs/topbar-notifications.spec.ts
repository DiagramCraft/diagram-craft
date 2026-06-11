import { test } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { secondWorkspace } from '../support/workspaces';

// This suite intentionally mutates seeded notification/watch state in the reserved second workspace.
test.describe.serial('topbar notifications', () => {
  test('notification bell shows 4 unread', async ({ page }) => {
    const homePage = new HomePage(page, secondWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(secondWorkspace.name);
    await homePage.workspaceShell.topBar.expectUnreadNotificationCount(4);
  });

  test('notification popup shows 4 items', async ({ page }) => {
    const homePage = new HomePage(page, secondWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(secondWorkspace.name);
    await homePage.workspaceShell.topBar.expectNotificationItemCount(4);
  });

  test('clearing one notification removes it', async ({ page }) => {
    const homePage = new HomePage(page, secondWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(secondWorkspace.name);
    await homePage.workspaceShell.topBar.clearNotification('Mobile App', 3);
  });

  test('clear all removes remaining notifications', async ({ page }) => {
    const homePage = new HomePage(page, secondWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(secondWorkspace.name);
    await homePage.workspaceShell.topBar.expectNotificationItemCount(3);
    await homePage.workspaceShell.topBar.clearAllNotifications();
  });

  test('watching tab shows 3 subscriptions', async ({ page }) => {
    const homePage = new HomePage(page, secondWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(secondWorkspace.name);
    await homePage.workspaceShell.topBar.expectWatchingItemCount(3);
  });

  test('one subscription can be removed', async ({ page }) => {
    const homePage = new HomePage(page, secondWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(secondWorkspace.name);
    await homePage.workspaceShell.topBar.unwatchEntity('Delivery Service', 2);
  });
});
