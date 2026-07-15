import { expect, test } from '@playwright/test';
import { defaultWorkspace } from '../support/workspaces';

const WIKI_HOME_ID = '00000000-0000-0000-0031-000000000006';

test.describe('markdown editor', () => {
  test('renders the seeded wiki page @quick', async ({ page }) => {
    await page.goto(`/${defaultWorkspace.slug}/content/wiki/${WIKI_HOME_ID}`);

    await expect(
      page.getByRole('heading', { name: 'Example Corp Wiki', exact: true })
    ).toBeVisible();
    await expect(page.getByText('Welcome to the Example Corp architecture wiki.')).toBeVisible();
  });

  test('restores editor mode through reload and browser history', async ({ page }) => {
    await page.goto(`/${defaultWorkspace.slug}/content/wiki/${WIKI_HOME_ID}`);
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(page).toHaveURL(/mode=edit/);

    await page.reload();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();

    await page.goBack();
    await expect(page).not.toHaveURL(/mode=edit/);
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeEnabled();
  });

  test('opens an externally mounted MDX document in read-only wiki mode', async ({ page }) => {
    const nodeId = 'external-mdx-node';
    const file = {
      id: nodeId,
      project_id: null,
      project_public_id: null,
      path: 'external-docs/architecture.mdx',
      name: 'architecture',
      role: null,
      size_bytes: 45,
      comment_count: 0,
      unresolved_comment_count: 0,
      is_template: false,
      is_workspace_template: false,
      preview_svg: null,
      created_at: '2026-07-15T00:00:00.000Z',
      updated_at: '2026-07-15T00:00:00.000Z',
      type: 'markdown',
      created_by: null,
      updated_by: null,
      mime_type: 'text/plain',
      original_filename: null,
      content_metadata: null,
      read_only: true,
      mount_id: 'external-mdx-mount'
    };

    await page.route('**/api/default/content', route =>
      route.fulfill({
        json: {
          rootFiles: [],
          folders: [
            {
              path: 'external-docs',
              name: 'external-docs',
              files: [file],
              read_only: true,
              mount_id: 'external-mdx-mount'
            }
          ]
        }
      })
    );
    await page.route(`**/api/default/markdown/${nodeId}`, route =>
      route.fulfill({
        json: {
          body: '# Architecture\n\nThis document comes from MDX.',
          attachments: []
        }
      })
    );
    await page.route(`**/api/default/markdown/${nodeId}/revisions`, route =>
      route.fulfill({ json: [] })
    );

    await page.goto(`/${defaultWorkspace.slug}/content/wiki/${nodeId}`);

    await expect(page).toHaveURL(new RegExp(`/content/wiki/${nodeId}`));
    await expect(page.getByRole('heading', { name: 'Architecture', exact: true })).toBeVisible();
    await expect(page.getByText('This document comes from MDX.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Attach file', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
  });
});
