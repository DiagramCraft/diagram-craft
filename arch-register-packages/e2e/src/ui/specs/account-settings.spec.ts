import { test, expect } from '@playwright/test';
import { SCHEMA_COLORS } from '@arch-register/api-types/colors';
import { AccountSettingsPage } from '../pages/AccountSettingsPage';
import { seededUser } from '../support/users';
import { defaultWorkspace } from '../support/workspaces';

test.describe('account settings', () => {
  test('changes the display name and changes it back @quick', async ({ page }) => {
    const accountSettingsPage = new AccountSettingsPage(page, defaultWorkspace.slug);
    const updatedDisplayName = `${seededUser.displayName} Test`;

    await accountSettingsPage.goto('profile');
    await accountSettingsPage.expectProfileLoaded();
    await expect(accountSettingsPage.displayNameInput()).toHaveValue(seededUser.displayName);

    await accountSettingsPage.changeDisplayName(updatedDisplayName);
    await accountSettingsPage.saveChanges();
    await accountSettingsPage.workspaceShell.topBar.expectAccountMenuVisible(
      updatedDisplayName,
      seededUser.email
    );

    await accountSettingsPage.changeDisplayName(seededUser.displayName);
    await accountSettingsPage.saveChanges();
    await accountSettingsPage.workspaceShell.topBar.expectAccountMenuVisible(
      seededUser.displayName,
      seededUser.email
    );
  });

  test('changes the avatar color and updates the topbar avatar color @quick', async ({ page }) => {
    const accountSettingsPage = new AccountSettingsPage(page, defaultWorkspace.slug);

    await accountSettingsPage.goto('appearance');
    await accountSettingsPage.expectAppearanceLoaded();

    const originalBackground = await accountSettingsPage.workspaceShell.topBar.accountMenuButton()
      .evaluate(element => getComputedStyle(element).backgroundImage);

    const updatedColor = SCHEMA_COLORS.find(color => color !== seededUser.color) ?? SCHEMA_COLORS[0]!;

    await accountSettingsPage.selectColor(updatedColor);
    await accountSettingsPage.saveChanges();

    await expect
      .poll(async () =>
        accountSettingsPage.workspaceShell.topBar.accountMenuButton()
          .evaluate(element => getComputedStyle(element).backgroundImage)
      )
      .not.toBe(originalBackground);

    await accountSettingsPage.selectColor(seededUser.color);
    await accountSettingsPage.saveChanges();

    await expect
      .poll(async () =>
        accountSettingsPage.workspaceShell.topBar.accountMenuButton()
          .evaluate(element => getComputedStyle(element).backgroundImage)
      )
      .toBe(originalBackground);
  });
});
