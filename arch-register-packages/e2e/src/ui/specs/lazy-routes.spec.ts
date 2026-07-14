import { expect, test } from '@playwright/test';
import { defaultWorkspace } from '../support/workspaces';

const extractModule = '**/src/sections/ai-extract/ExtractScreen.tsx*';

test.describe('lazy workspace routes', () => {
  test('opens lazy feature routes directly @quick', async ({ page }) => {
    await page.goto(`/${defaultWorkspace.slug}/content`);
    await expect(page.getByPlaceholder('Filter diagrams…')).toBeVisible();

    await page.goto(`/${defaultWorkspace.slug}/extract`);
    await expect(page.getByRole('button', { name: 'Extract entities' })).toBeVisible();

    await page.goto(`/${defaultWorkspace.slug}/settings/analytics`);
    await expect(page.getByRole('tablist', { name: 'Analytics views' })).toBeVisible();
  });

  test('keeps the workspace shell visible while a route module loads', async ({ page }) => {
    let releaseModule = () => {};
    const moduleGate = new Promise<void>(resolve => {
      releaseModule = resolve;
    });

    await page.route(extractModule, async route => {
      await moduleGate;
      await route.continue();
    });

    await page.goto(`/${defaultWorkspace.slug}/extract`, { waitUntil: 'commit' });
    try {
      await expect(page.getByRole('status')).toContainText('Loading view…');
      await expect(page.getByLabel('Workspace overview', { exact: true })).toBeVisible();
    } finally {
      releaseModule();
    }
    await expect(page.getByRole('button', { name: 'Extract entities' })).toBeVisible();
  });

  test('shows the recoverable content error when a route module fails', async ({ page }) => {
    await page.route(extractModule, route => route.abort('failed'));

    await page.goto(`/${defaultWorkspace.slug}/extract`, { waitUntil: 'commit' });

    await expect(page.getByRole('heading', { name: 'This panel crashed' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reload page' })).toBeVisible();
    await expect(page.getByLabel('Workspace overview', { exact: true })).toBeVisible();
  });
});
