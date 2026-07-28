import { expect, test } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { defaultWorkspace } from '../support/workspaces';

test.describe('dashboard section', () => {
  test('admin can enter edit mode, add a widget, and see it persist on reload @quick', async ({
    page
  }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(defaultWorkspace.name);
    await homePage.expectEditModeAvailable();

    await homePage.enterEditMode();
    await homePage.addWidgetButton().click();
    await page.getByRole('button', { name: 'Lifecycle chart' }).click();
    await expect(page.getByText('Lifecycle Breakdown').first()).toBeVisible();

    await homePage.saveDashboard();
    await expect(homePage.editDashboardButton()).toBeVisible();

    await page.reload();
    await homePage.expectLoaded(defaultWorkspace.name);
  });

  test('cancelling edit mode discards unsaved layout changes', async ({ page }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(defaultWorkspace.name);

    await homePage.enterEditMode();
    await homePage.addWidgetButton().click();
    await page.getByRole('button', { name: 'Stale entity report' }).click();
    await expect(page.getByText('Not changed in').first()).toBeVisible();

    await homePage.cancelDashboardButton().click();
    await expect(homePage.editDashboardButton()).toBeVisible();
    await expect(page.getByText('Not changed in')).toHaveCount(0);
  });

  test('admin can create, rename, switch to, and delete a dashboard @quick', async ({ page }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(defaultWorkspace.name);

    await homePage.createDashboard('Security posture');
    await expect(homePage.dashboardRow('Security posture')).toBeVisible();
    await homePage.switchDashboard('Security posture');

    await homePage.renameDashboard('Security posture', 'Security posture v2');
    await expect(homePage.dashboardRow('Security posture v2')).toBeVisible();

    await homePage.deleteDashboard('Security posture v2');
    await expect(homePage.dashboardRow('Security posture v2')).toHaveCount(0);
  });
});
