import { expect, test } from '@playwright/test';
import { DataModelPage } from '../pages/DataModelPage';
import { workspaceModelOverviewRoute } from '../support/routes';
import { componentSchema } from '../support/schemas';
import { defaultWorkspace } from '../support/workspaces';

test.describe('data model section', () => {
  test('shows schema editor @quick', async ({ page }) => {
    const dataModelPage = new DataModelPage(page, defaultWorkspace.slug);

    await dataModelPage.goto();
    await dataModelPage.expectLoaded();
  });

  test('opens a schema type from the sidebar @quick', async ({ page }) => {
    const dataModelPage = new DataModelPage(page, defaultWorkspace.slug);

    await dataModelPage.goto();
    await dataModelPage.expectLoaded();
    await dataModelPage.openSchemaType(componentSchema.name);
  });

  test('creates a new entity type', async ({ page }) => {
    const dataModelPage = new DataModelPage(page, defaultWorkspace.slug);

    await dataModelPage.goto();
    await dataModelPage.expectLoaded();

    try {
      await dataModelPage.createNewEntityType();
    } finally {
      await dataModelPage.deleteSelectedEntityType();
    }
  });

  test('restores model overview layout state through reload and browser history', async ({ page }) => {
    const route = workspaceModelOverviewRoute(defaultWorkspace.slug);
    const layoutTrigger = page.getByTestId('model-overview-layout');
    const horizontalSpacingInput = page
      .getByTestId('model-overview-horizontal-spacing')
      .locator('input');
    const iterationsInput = page.getByTestId('model-overview-iterations').locator('input');

    await page.goto(route);

    await layoutTrigger.click();
    await page.getByText('Force-directed').click();
    await expect(page).toHaveURL(/layout=force/);

    await iterationsInput.fill('450');
    await expect(page).toHaveURL(/iterations=450/);

    await layoutTrigger.click();
    await page.getByText('Layered').click();
    await expect(page).toHaveURL(/layout=layered/);
    await expect(page).not.toHaveURL(/iterations=450/);

    await horizontalSpacingInput.fill('260');
    await expect(page).toHaveURL(/horizontalSpacing=260/);

    await layoutTrigger.click();
    await page.getByText('Force-directed').click();
    await expect(iterationsInput).toHaveValue(/450/);
    await expect(page).toHaveURL(/layout=force/);
    await expect(page).toHaveURL(/iterations=450/);

    await page.reload();
    await expect(layoutTrigger).toContainText('Force-directed');
    await expect(iterationsInput).toHaveValue(/450/);

    await page.goBack();
    await expect(layoutTrigger).toContainText('Layered');
    await expect(horizontalSpacingInput).toHaveValue(/260/);
    await expect(page).toHaveURL(/layout=layered/);
    await expect(page).toHaveURL(/horizontalSpacing=260/);

    await page.goBack();
    await expect(layoutTrigger).toContainText('Force-directed');
    await expect(iterationsInput).toHaveValue(/450/);
    await expect(page).toHaveURL(/layout=force/);
    await expect(page).toHaveURL(/iterations=450/);
    await expect(page).not.toHaveURL(/horizontalSpacing=260/);

    await page.goBack();
    await expect(layoutTrigger).toContainText('Hierarchy');
    await expect(page).not.toHaveURL(/iterations=450/);
    await expect(page).not.toHaveURL(/horizontalSpacing=260/);

    await page.goForward();
    await expect(layoutTrigger).toContainText('Force-directed');
    await expect(iterationsInput).toHaveValue(/450/);

    await page.goForward();
    await expect(layoutTrigger).toContainText('Layered');
    await expect(horizontalSpacingInput).toHaveValue(/260/);
  });

  test('falls back to defaults for invalid model overview search params', async ({ page }) => {
    const route = `${workspaceModelOverviewRoute(defaultWorkspace.slug)}?layout=force&iterations=5&springStrength=0.8`;
    const layoutTrigger = page.getByTestId('model-overview-layout');
    const iterationsInput = page.getByTestId('model-overview-iterations').locator('input');
    const springStrengthInput = page
      .getByTestId('model-overview-spring-strength')
      .locator('input');

    await page.goto(route);

    await expect(layoutTrigger).toContainText('Force-directed');
    await expect(iterationsInput).toHaveValue(/300/);
    await expect(springStrengthInput).toHaveValue(/0.8/);
  });
});
