import { expect, test } from '@playwright/test';
import { EntitiesPage } from '../pages/EntitiesPage';
import { SearchPage } from '../pages/SearchPage';
import { customerApiEntity } from '../support/entities';
import { defaultWorkspace } from '../support/workspaces';

test.describe('search section', () => {
  test('shows search interface @quick', async ({ page }) => {
    const searchPage = new SearchPage(page, defaultWorkspace.slug);

    await searchPage.goto();
    await searchPage.expectLoaded();
  });

  test('returns entity results when searching @quick', async ({ page }) => {
    const searchPage = new SearchPage(page, defaultWorkspace.slug);

    await searchPage.goto();
    await searchPage.expectLoaded();
    await searchPage.search('API');
    await searchPage.expectEntityResultsFound();
  });

  test('opens entity details from a search result @quick', async ({ page }) => {
    const searchPage = new SearchPage(page, defaultWorkspace.slug);
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);

    await searchPage.goto();
    await searchPage.expectLoaded();
    await searchPage.search(customerApiEntity.name);
    await searchPage.expectResultVisible(customerApiEntity.name);

    await searchPage.resultRow(customerApiEntity.name).click();

    await expect(page).toHaveURL(
      new RegExp(`/${defaultWorkspace.slug}/entities/${customerApiEntity.publicId}$`)
    );
    await entitiesPage.expectEntityDetailLoaded(customerApiEntity.name);
  });

  test('restores the selected category through reload and browser history', async ({ page }) => {
    const searchPage = new SearchPage(page, defaultWorkspace.slug);

    await searchPage.goto();
    await searchPage.search('API');
    await page.getByTestId('search-category-Entities').click();
    await expect(page).toHaveURL(/category=entities/);

    await page.reload();
    await expect(page.getByTestId('search-category-Entities')).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    await page.goBack();
    await expect(page).not.toHaveURL(/category=/);
  });
});
