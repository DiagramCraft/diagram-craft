import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { authMigrationProject } from '../../arch-register-packages/e2e/src/ui/support/projects';
import { frontendAppEntity } from '../../arch-register-packages/e2e/src/ui/support/entities';
import { defaultWorkspace } from '../../arch-register-packages/e2e/src/ui/support/workspaces';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const diagramCraftUserState = {
  panelLeft: 0,
  panelLeftWidth: 320,
  panelRight: -1,
  showHelp: false,
  stencilPickerViewMode: 'grid',
  stencilSearchAllPackages: false,
  stencils: [{ id: 'default', isOpen: true }],
  toolWindowTabs: { picker: 'picker' }
} as const;

export const createBlankDiagramDocument = (name: string) => {
  const diagramId = randomUUID();
  const layerId = randomUUID();

  return {
    name,
    diagrams: [
      {
        id: diagramId,
        name,
        layers: [
          {
            id: layerId,
            name: 'Default',
            type: 'layer',
            layerType: 'regular',
            elements: [],
            isLocked: false
          }
        ],
        activeLayerId: layerId,
        visibleLayers: [layerId],
        diagrams: [],
        comments: [],
        zoom: { x: 0, y: 0, zoom: 1 },
        canvas: { x: -20, y: -20, w: 1076, h: 904 }
      }
    ],
    attachments: {},
    customPalette: Array(14).fill('#000000'),
    styles: {
      edgeStyles: [
        {
          id: 'default-edge',
          name: 'Default',
          props: { stroke: { color: 'var(--canvas-fg)' }, type: 'straight' },
          type: 'edge'
        }
      ],
      nodeStyles: [
        {
          id: 'default',
          name: 'Default',
          props: {
            fill: { color: 'var(--canvas-bg2)' },
            stroke: { color: 'var(--canvas-fg)' },
            text: { color: 'var(--canvas-fg)' }
          },
          type: 'node'
        },
        {
          id: 'default-text',
          name: 'Text',
          props: {
            fill: { enabled: false },
            stroke: { enabled: false },
            text: { color: 'var(--canvas-fg)' }
          },
          type: 'node'
        }
      ],
      textStyles: [
        {
          id: 'default-text-default',
          name: 'Default',
          props: {
            text: { fontSize: 10, font: 'sans-serif', top: 0, left: 0, right: 0, bottom: 0 }
          },
          type: 'text'
        },
        {
          id: 'h1',
          name: 'H1',
          props: {
            text: {
              fontSize: 20,
              bold: true,
              font: 'sans-serif',
              align: 'left',
              top: 6,
              left: 6,
              right: 6,
              bottom: 6
            }
          },
          type: 'text'
        }
      ]
    },
    schemas: [
      {
        id: 'default',
        name: 'Default',
        providerId: 'default',
        fields: [
          { id: 'name', name: 'Name', type: 'text' },
          { id: 'notes', name: 'Notes', type: 'longtext' }
        ]
      }
    ],
    schemaMetadata: {
      default: { availableForElementLocalData: false, useDocumentOverrides: false }
    },
    props: {
      query: { history: [], saved: [] },
      stencils: ['default@@rect'],
      activeStencilPackages: [],
      recentEdgeStylesheets: []
    },
    data: {
      providers: [
        {
          id: 'default',
          providerId: 'defaultDataProvider',
          data: '{"schemas":[{"id":"default","name":"Default","providerId":"default","fields":[{"id":"name","name":"Name","type":"text"},{"id":"notes","name":"Notes","type":"longtext"}]}],"data":[]}'
        }
      ],
      templates: [],
      overrides: {}
    },
    activeDiagramId: diagramId,
    hash: `${randomUUID()}${randomUUID()}`
  };
};

export const openProjectNewDiagramDialog = async (page: Page) => {
  await page.getByRole('main').getByRole('button', { name: 'New' }).click();
  const newDiagramItem = page.getByRole('menuitem', { name: 'New diagram' });
  await expect(newDiagramItem).toBeVisible();
  await newDiagramItem.click();
  await expect(page.getByText('Choose a starting point')).toBeVisible();
};

export const createBlankProjectDiagram = async (page: Page, name: string) => {
  await page.evaluate(
    async ({ workspaceSlug, projectId, diagramName, diagramBody }) => {
      const response = await fetch(
        `/api/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/files?path=${encodeURIComponent(diagramName)}.json`,
        {
          method: 'PUT',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify(diagramBody)
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create diagram: ${response.status}`);
      }
    },
    {
      workspaceSlug: defaultWorkspace.slug,
      projectId: authMigrationProject.id,
      diagramName: name,
      diagramBody: createBlankDiagramDocument(name)
    }
  );

  await page.reload();
  await expect(page.getByRole('main').getByRole('button', { name: new RegExp(escapeRegExp(name)) })).toBeVisible();
};

export const openDiagramEditorFromProject = async (page: Page, name: string) => {
  await page.getByRole('main').getByRole('button', { name: new RegExp(escapeRegExp(name)) }).first().click();
  await expect(page.locator('#awareness')).toBeVisible();
};

export const createWikiPage = async (
  page: Page,
  scope: 'workspace' | 'project' | 'entity',
  name: string,
  folder?: string
) =>
  await page.evaluate(
    async ({ workspaceSlug, scope, name, folder, projectId, entityId }) => {
      const payload = JSON.stringify({ name, ...(folder ? { folder } : {}) });
      const endpoint =
        scope === 'workspace'
          ? `/api/${encodeURIComponent(workspaceSlug)}/content/markdown`
          : scope === 'project'
            ? `/api/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/markdown`
            : `/api/${encodeURIComponent(workspaceSlug)}/entities/${encodeURIComponent(entityId)}/markdown`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload
      });

      if (!response.ok) {
        throw new Error(`Failed to create markdown page: ${response.status}`);
      }

      return (await response.json()) as { id: string; name: string; path: string };
    },
    {
      workspaceSlug: defaultWorkspace.slug,
      scope,
      name,
      folder,
      projectId: authMigrationProject.id,
      entityId: frontendAppEntity.id
    }
  );

export const saveWikiContent = async (page: Page, nodeId: string, body: string) =>
  await page.evaluate(
    async ({ workspaceSlug, nodeId, body }) => {
      const response = await fetch(
        `/api/${encodeURIComponent(workspaceSlug)}/markdown/${encodeURIComponent(nodeId)}`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ body })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to save markdown content: ${response.status}`);
      }

      return (await response.json()) as { id: string; path: string; name: string };
    },
    { workspaceSlug: defaultWorkspace.slug, nodeId, body }
  );

export const seedWikiPage = async (
  page: Page,
  scope: 'workspace' | 'project' | 'entity',
  options: {
    name: string;
    summary: string;
    contextTitle: string;
    contextBullets: string[];
    nextSteps: string[];
    entityId: string;
    entityFields?: string;
  }
) => {
  const created = await createWikiPage(page, scope, options.name);

  const body = [
    `# ${options.name}`,
    '',
    options.summary,
    '',
    '## Reference',
    '',
    `<EntityCard id="${options.entityId}" fields="${options.entityFields ?? 'owner,lifecycle,description'}" />`,
    '',
    `## ${options.contextTitle}`,
    '',
    ...options.contextBullets.map(bullet => `- ${bullet}`),
    '',
    '## Next steps',
    '',
    ...options.nextSteps.map((item, index) => `${index + 1}. ${item}`),
    '',
    '> Keep this page short and close to the work it describes.'
  ].join('\n');

  await saveWikiContent(page, created.id, body);
  await page.goto(
    scope === 'workspace'
      ? `/${defaultWorkspace.slug}/content/wiki/${created.id}?mode=preview`
      : scope === 'project'
        ? `/${defaultWorkspace.slug}/projects/${authMigrationProject.id}/wiki/${created.id}?mode=preview`
        : `/${defaultWorkspace.slug}/entities/${frontendAppEntity.id}/wiki/${created.id}?mode=preview`
  );
  await expect(page.getByText(options.summary)).toBeVisible();
  return { nodeId: created.id };
};

export const setStoredThemes = async (page: Page, theme: 'light' | 'dark') => {
  await page.evaluate(
    ({ requestedTheme, state }) => {
      localStorage.setItem('ar-theme', requestedTheme);

      const current = JSON.parse(localStorage.getItem('diagram-craft.user-state') ?? '{}');
      localStorage.setItem(
        'diagram-craft.user-state',
        JSON.stringify({
          ...current,
          ...state,
          themePreference: requestedTheme,
          themeMode: requestedTheme
        })
      );
    },
    { requestedTheme: theme, state: diagramCraftUserState }
  );
};

export const waitForThemeApplied = async (page: Page, theme: 'light' | 'dark') => {
  await page.waitForFunction(
    expectedTheme => {
      const root = document.documentElement;
      const archRegisterMatches =
        expectedTheme === 'light'
          ? root.getAttribute('data-theme') === 'light' && !root.classList.contains('dark')
          : !root.hasAttribute('data-theme') && root.classList.contains('dark');

      const diagramCraftRoot = document.getElementById('app');
      const diagramCraftClassName = expectedTheme === 'dark' ? 'dark-theme' : 'light-theme';
      const diagramCraftMatches =
        diagramCraftRoot == null
          ? true
          : diagramCraftRoot.classList.contains(diagramCraftClassName) ||
            (diagramCraftRoot.getAttribute('data-theme') === expectedTheme &&
              document.body.classList.contains(diagramCraftClassName));

      if (diagramCraftRoot != null) {
        return diagramCraftMatches;
      }

      return archRegisterMatches;
    },
    theme,
    { timeout: 5000 }
  );
};

export const setDiagramCraftTheme = async (page: Page, theme: 'light' | 'dark') => {
  await page.goto('/');
  await setStoredThemes(page, theme);
};

export const loadDiagramCraftSample = async (page: Page, sampleName: string) => {
  await page.goto(`/?crdtClear=true#/sample/${sampleName}`);
  await waitForDiagramCraftLoaded(page);
};

export const waitForDiagramCraftLoaded = async (page: Page) => {
  await page.getByRole('toolbar').first().waitFor();
  await expect(page.locator('#left-sidebar')).toBeVisible();
};

export const selectDiagramCraftTool = async (page: Page, tool: 'TOOL_MOVE' | 'TOOL_EDGE' | 'TOOL_TEXT') => {
  const button = page.getByLabel(tool);
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
};

export const clickDiagramCraftElement = async (
  page: Page,
  elementSelector: string,
  options?: { clickCount?: number }
) => {
  const element = page.locator(elementSelector).first();
  await element.waitFor({ state: 'attached' });
  await element.click({ clickCount: options?.clickCount ?? 1, force: true });
};
