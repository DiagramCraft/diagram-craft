import { test } from '@playwright/test';
import { SettingsPage } from '../pages/SettingsPage';
import { defaultWorkspace } from '../support/workspaces';

test.describe('settings section', () => {
  test('shows workspace settings @quick', async ({ page }) => {
    const settingsPage = new SettingsPage(page, defaultWorkspace.slug);

    await settingsPage.goto();
    await settingsPage.expectLoaded();
  });
});
