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

  test('admin can add and configure API Catalog widgets on a workspace dashboard', async ({
    page
  }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);
    const dashboardName = `API Catalog widgets ${Date.now()}`;
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
        { pickerName: /API catalog stats/, title: 'Pilot API stats' },
        {
          pickerName: /Open API change and deprecation cases/,
          title: 'Pilot decision queue',
          limit: 4
        },
        {
          pickerName: /APIs with the most registered consumers/,
          title: 'Pilot most consumed',
          limit: 5
        },
        {
          pickerName: /Data flows that cross a boundary/,
          title: 'Pilot at-risk integrations',
          limit: 7
        }
      ];

      for (const widget of widgets) {
        await homePage.addWidgetButton().click();
        await page.getByRole('button', { name: widget.pickerName }).click();
        await page.getByRole('button', { name: 'Edit widget' }).last().click();

        const dialog = page.getByRole('alertdialog');
        await dialog.getByLabel('Title').fill(widget.title);
        if (widget.limit !== undefined) {
          await dialog.getByLabel('Maximum visible items').fill(String(widget.limit));
        }
        await dialog.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page.getByText(widget.title, { exact: true })).toBeVisible();
      }

      await homePage.saveDashboard();
      await page.reload();
      await homePage.expectLoaded(defaultWorkspace.name);
      for (const widget of widgets) {
        await expect(page.getByText(widget.title, { exact: true })).toBeVisible();
      }
      await expect(page.getByText(/Unsupported dashboard widget/)).toHaveCount(0);

      await homePage.enterEditMode();
      const editWidgetButtons = page.getByRole('button', { name: 'Edit widget' });
      const firstPilotWidgetIndex = (await editWidgetButtons.count()) - widgets.length;
      for (const [index, widget] of widgets.entries()) {
        await editWidgetButtons.nth(firstPilotWidgetIndex + index).click();
        const dialog = page.getByRole('alertdialog');
        await expect(dialog.getByLabel('Title')).toHaveValue(widget.title);
        if (widget.limit !== undefined) {
          await expect(dialog.getByLabel('Maximum visible items')).toHaveValue(
            String(widget.limit)
          );
        }
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      }
      await homePage.cancelDashboardButton().click();

      await page.getByRole('button', { name: 'Catalog', exact: true }).last().click();
      await expect(page).toHaveURL(
        new RegExp(`/${defaultWorkspace.slug}/api-integration-catalog/apis`)
      );
      await homePage.goto();
      await homePage.switchDashboard(dashboardName);
      const mostConsumedFrame = page
        .getByText('Pilot most consumed', { exact: true })
        .locator('xpath=../../..');
      await mostConsumedFrame.getByRole('button', { name: /API/ }).first().click();
      await expect(page).toHaveURL(
        url =>
          url.pathname.endsWith('/api-integration-catalog/apis') && url.searchParams.has('drawer')
      );
      await homePage.goto();
      await homePage.switchDashboard(dashboardName);
      await page.getByRole('button', { name: 'All integrations', exact: true }).last().click();
      await expect(page).toHaveURL(
        url =>
          url.pathname.endsWith('/api-integration-catalog/integrations') &&
          url.searchParams.get('boundary') === '"1"'
      );
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
