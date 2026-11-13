import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { test } from '../fixtures';
import { workspaceModelRoute } from '../support/routes';

const api = (page: Page, path: string) =>
  new URL(`/api/application/v1${path}`, page.url()).toString();

// Uses a fresh workspace in draft mode so the seeded workspaces are left untouched
const setupDraftWorkspace = async (page: Page) => {
  const badge = Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join('');
  const created = await page.request.post(api(page, '/workspaces'), {
    data: { name: `Draft UI ${randomUUID()}`, badge }
  });
  expect(created.ok()).toBeTruthy();
  const { url_slug: slug } = (await created.json()) as { url_slug: string };

  const mode = await page.request.put(api(page, `/${slug}/schema-draft/mode`), {
    data: { schemaChangeMode: 'draft' }
  });
  expect(mode.ok()).toBeTruthy();
  return slug;
};

const stageEnum = async (page: Page, slug: string, expectedRevision: number, name: string) => {
  const response = await page.request.put(
    api(page, `/${slug}/schema-draft/items/enum/${randomUUID()}`),
    { data: { expectedRevision, op: 'create', payload: { name, options: [] } } }
  );
  expect(response.ok()).toBeTruthy();
};

test.describe('schema draft workflow', () => {
  test('reviews and publishes a staged change', async ({ page }) => {
    const slug = await setupDraftWorkspace(page);
    await stageEnum(page, slug, 0, 'Staged enum');

    await page.goto(workspaceModelRoute(slug));
    await expect(page.getByTestId('schema-draft-banner')).toBeVisible();

    await page.getByTestId('schema-draft-review-button').click();
    await expect(page.getByTestId('review-changes')).toContainText('Staged enum');

    await page.getByTestId('schema-draft-publish-button').click();
    await page.locator('textarea[data-testid="publish-summary"]').fill('First release');
    await page.getByRole('button', { name: 'Publish', exact: true }).click();

    await expect(page.getByTestId('schema-draft-banner')).toHaveCount(0);

    const publications = await page.request.get(api(page, `/${slug}/schema-publications`));
    expect(await publications.json()).toEqual([
      expect.objectContaining({ number: 1, summary: 'First release' })
    ]);
  });

  test('discards a draft without publishing', async ({ page }) => {
    const slug = await setupDraftWorkspace(page);
    await stageEnum(page, slug, 0, 'Discarded enum');

    await page.goto(workspaceModelRoute(slug));
    await page.getByTestId('schema-draft-review-button').click();
    await page.getByTestId('schema-draft-revert-all-button').click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Revert all', exact: true })
      .click();

    await expect(page.getByTestId('schema-draft-banner')).toHaveCount(0);
    const draft = await page.request.get(api(page, `/${slug}/schema-draft`));
    expect(await draft.json()).toMatchObject({ items: [] });
  });
});
