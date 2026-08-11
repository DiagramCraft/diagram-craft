import { expect, type Page } from '@playwright/test';
import { test } from '../fixtures';
import { defaultWorkspace } from '../support/workspaces';

test.use({ authenticated: false });

const entity = {
  publicId: 'API-1',
  slug: 'public-api',
  name: 'Public API',
  namespace: 'platform',
  description: 'An API published for external consumers.',
  owner: 'Platform team',
  lifecycle: 'Active',
  tags: ['external'],
  updatedAt: '2026-01-15T00:00:00.000Z',
  schema: {
    id: 'api-schema',
    name: 'API',
    keyPrefix: 'API',
    fields: [{ id: 'owner', name: 'Owner', type: 'text' }]
  },
  fields: { owner: 'Platform team' },
  apiArtifacts: [
    {
      artifactId: 'artifact-1',
      entityPublicId: 'API-1',
      title: 'Public API',
      protocol: 'openapi',
      currentRevisionId: 'revision-1',
      rawAvailable: false
    }
  ]
};

const manifest = {
  workspace: defaultWorkspace.slug,
  title: 'Platform Catalog',
  description: 'Published architecture information for external consumers.',
  indexable: false,
  schemas: [
    {
      id: 'api-schema',
      name: 'API',
      description: 'Published APIs',
      keyPrefix: 'API',
      fields: [{ id: 'owner', name: 'Owner', type: 'text' }]
    }
  ],
  pages: [
    {
      path: 'guide',
      label: 'Getting started',
      scope: 'workspace',
      entityPublicId: null
    }
  ],
  apiArtifacts: [
    {
      artifactId: 'artifact-1',
      entityPublicId: 'API-1',
      title: 'Public API',
      protocol: 'openapi',
      currentRevisionId: 'revision-1',
      rawAvailable: false
    }
  ],
  entityCount: 1,
  endpoints: { entities: '/entities', wiki: '/wiki' }
};

const wiki = {
  path: 'guide',
  label: 'Getting started',
  scope: 'workspace',
  entityPublicId: null,
  updatedAt: '2026-01-15T00:00:00.000Z',
  body: `## Theme details

The public catalog supports **light and dark themes**.

> Published content remains read-only.

| Surface | Status |
| --- | --- |
| Entities | Published |
| APIs | Published |

\`\`\`ts
const theme = 'dark';
\`\`\`
`
};

const apiSpecification = {
  revision: {
    protocol: 'openapi',
    title: 'Public API',
    description: 'Normalized operations published for external consumers.',
    itemCount: 1,
    revision: { id: 'revision-1' }
  },
  items: [
    {
      id: 'operation-1',
      action: 'get',
      path: '/catalog/entities',
      channel: null,
      identifier: 'listEntities',
      summary: 'List published entities',
      description: 'Returns the public entity projection.',
      tags: ['catalog']
    }
  ],
  total: 1,
  limit: 200,
  offset: 0
};

const mockPublicCatalog = async (page: Page) => {
  await page.route(`**/api/public/v1/${defaultWorkspace.slug}/**`, async route => {
    const url = new URL(route.request().url());
    const basePath = `/api/public/v1/${defaultWorkspace.slug}`;
    const path = url.pathname.slice(basePath.length);

    if (path === '/manifest') {
      await route.fulfill({ json: manifest });
      return;
    }
    if (path === '/entities') {
      await route.fulfill({ json: { items: [entity], total: 1 } });
      return;
    }
    if (path === `/entities/${entity.publicId}`) {
      await route.fulfill({ json: entity });
      return;
    }
    if (path === '/wiki') {
      await route.fulfill({ json: wiki });
      return;
    }
    if (path.includes('/api-specifications/')) {
      await route.fulfill({ json: apiSpecification });
      return;
    }

    await route.continue();
  });
};

test.describe('public catalog themes', () => {
  test('follows the system theme until an explicit choice is made', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await mockPublicCatalog(page);
    await page.goto(`/public/${defaultWorkspace.slug}`);

    await expect(page.getByRole('heading', { name: 'Platform Catalog' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('button', { name: 'Light' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.getByRole('button', { name: 'Dark' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    await expect(page).toHaveScreenshot('public-catalog-light-home.png', { fullPage: true });

    await page.getByRole('button', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.getByRole('button', { name: 'Dark' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem('diagram-craft.user-state') ?? '{}').themeMode
        )
      )
      .toBe('dark');

    await page.getByRole('link', { name: 'Entities' }).click();
    await page.waitForURL(`**/public/${defaultWorkspace.slug}/entities`);
    await expect(page.getByRole('heading', { name: 'Entities' })).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.getByRole('link', { name: 'Getting started' }).click();
    await page.waitForURL(`**/public/${defaultWorkspace.slug}/wiki?path=guide`);
    await expect(
      page.locator('main').getByRole('heading', { name: 'Getting started' }).last()
    ).toBeVisible();
    await expect(page.locator('pre')).toContainText("const theme = 'dark'");
    await expect(page).toHaveScreenshot('public-catalog-dark-wiki.png', { fullPage: true });

    await page.goto(
      `/public/${defaultWorkspace.slug}/api/${entity.publicId}/artifact-1/revision-1`
    );
    await expect(page.getByRole('heading', { name: 'Public API' })).toBeVisible();
    await expect(page.getByText('/catalog/entities')).toBeVisible();
    await expect(page).toHaveScreenshot('public-catalog-dark-api.png', { fullPage: true });
  });

  test('uses the dark system theme and keeps controls keyboard-operable', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await mockPublicCatalog(page);
    await page.goto(`/public/${defaultWorkspace.slug}`);

    await expect(page.locator('html')).toHaveClass(/dark/);
    const lightButton = page.getByRole('button', { name: 'Light' });
    await lightButton.focus();
    await expect(lightButton).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(lightButton).toHaveAttribute('aria-pressed', 'true');
  });

  test('renders a themed error state when the catalog is unavailable', async ({ page }) => {
    await page.route(`**/api/public/v1/${defaultWorkspace.slug}/manifest`, route =>
      route.abort('failed')
    );
    await page.goto(`/public/${defaultWorkspace.slug}`);

    await expect(page.getByText('This public catalog is not available.')).toBeVisible({
      timeout: 15_000
    });
    await expect(page.locator('body')).toHaveCSS('background-color', /rgb/);
  });
});
