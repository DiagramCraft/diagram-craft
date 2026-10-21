import { expect } from '@playwright/test';
import { test } from '../fixtures';
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
    await expect(page.getByText('Lifecycle').first()).toBeVisible();

    await homePage.saveDashboard();
    await expect(homePage.editDashboardButton()).toBeVisible();

    await page.reload();
    await homePage.expectLoaded(defaultWorkspace.name);
  });

  test('admin can add and retitle widgets on a workspace dashboard', async ({ page }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);
    const dashboardName = `Widget titles ${Date.now()}`;
    let dashboardCreated = false;

    try {
      await homePage.goto();
      await homePage.expectLoaded(defaultWorkspace.name);
      await homePage.createDashboard(dashboardName);
      dashboardCreated = true;
      await expect(homePage.dashboardRow(dashboardName)).toBeVisible();
      await homePage.switchDashboard(dashboardName);
      await homePage.enterEditMode();

      const widgets = [
        { pickerName: /^Stale entity report/, title: 'Pilot stale report' },
        { pickerName: /^Lifecycle chart/, title: 'Pilot lifecycle' },
        { pickerName: /^Markdown/, title: 'Pilot notes' }
      ];

      for (const widget of widgets) {
        await homePage.addWidgetButton().click();
        await page.getByRole('button', { name: widget.pickerName }).click();
        await page.getByRole('button', { name: 'Edit widget' }).last().click();

        const dialog = page.getByRole('alertdialog');
        await dialog.getByRole('tab', { name: 'Appearance' }).click();
        await dialog.getByRole('tabpanel').getByRole('textbox').first().fill(widget.title);
        await dialog.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page.getByText(widget.title, { exact: true })).toBeVisible();
      }

      await homePage.saveDashboard();
      await page.reload();
      await homePage.expectLoaded(defaultWorkspace.name);
      await expect(page.getByText(/Unsupported dashboard widget/)).toHaveCount(0);

      await homePage.enterEditMode();
      const editWidgetButtons = page.getByRole('button', { name: 'Edit widget' });
      const firstPilotWidgetIndex = (await editWidgetButtons.count()) - widgets.length;
      for (const [index, widget] of widgets.entries()) {
        await editWidgetButtons.nth(firstPilotWidgetIndex + index).click();
        const dialog = page.getByRole('alertdialog');
        await dialog.getByRole('tab', { name: 'Appearance' }).click();
        await expect(dialog.getByRole('tabpanel').getByRole('textbox').first()).toHaveValue(
          widget.title
        );
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      }
      await homePage.cancelDashboardButton().click();
    } finally {
      if (dashboardCreated && !page.isClosed()) {
        await homePage.goto();
        await homePage.deleteDashboard(dashboardName);
      }
    }
  });

  test('cancelling edit mode discards unsaved layout changes', async ({ page }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(defaultWorkspace.name);

    await homePage.enterEditMode();
    await homePage.addWidgetButton().click();
    await page.getByRole('button', { name: 'Stale entity report' }).click();
    await expect(page.getByText('Stale entity report', { exact: true }).last()).toBeVisible();

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
