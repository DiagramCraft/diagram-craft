import { test } from '@playwright/test';
import { SettingsPage } from '../pages/SettingsPage';
import { loginAsSeededUser } from '../support/auth';
import { defaultWorkspace } from '../support/workspaces';

test.describe('settings section', () => {
  test('shows workspace settings', async ({ page }) => {
    const settingsPage = new SettingsPage(page, defaultWorkspace.slug);

    await loginAsSeededUser(page);
    await settingsPage.goto();
    await settingsPage.expectLoaded();
  });
});
