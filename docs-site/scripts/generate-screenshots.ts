import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium, expect, type Browser, type Page } from '@playwright/test';
import { AccountSettingsPage } from '../../arch-register-packages/e2e/src/ui/pages/AccountSettingsPage';
import { DataModelPage } from '../../arch-register-packages/e2e/src/ui/pages/DataModelPage';
import { EntitiesPage } from '../../arch-register-packages/e2e/src/ui/pages/EntitiesPage';
import { HomePage } from '../../arch-register-packages/e2e/src/ui/pages/HomePage';
import { LoginPage } from '../../arch-register-packages/e2e/src/ui/pages/LoginPage';
import { ProjectsPage } from '../../arch-register-packages/e2e/src/ui/pages/ProjectsPage';
import { SearchPage } from '../../arch-register-packages/e2e/src/ui/pages/SearchPage';
import { SettingsPage } from '../../arch-register-packages/e2e/src/ui/pages/SettingsPage';
import { authMigrationProject } from '../../arch-register-packages/e2e/src/ui/support/projects';
import { authApiEntity, authServiceEntity, frontendAppEntity } from '../../arch-register-packages/e2e/src/ui/support/entities';
import { apiSchema, componentSchema } from '../../arch-register-packages/e2e/src/ui/support/schemas';
import { defaultWorkspace } from '../../arch-register-packages/e2e/src/ui/support/workspaces';
import { workspaceModelRoute } from '../../arch-register-packages/e2e/src/ui/support/routes';

type Viewport = {
  width: number;
  height: number;
};

type ScreenshotContext = {
  accountSettingsPage: AccountSettingsPage;
  homePage: HomePage;
  entitiesPage: EntitiesPage;
  projectsPage: ProjectsPage;
  searchPage: SearchPage;
  settingsPage: SettingsPage;
  dataModelPage: DataModelPage;
};

export type ScreenshotConfig = {
  product: 'arch-register';
  category: string;
  name: string;
  viewport?: Viewport;
  selector?: string;
  selectorGap?: number;
  fullPage?: boolean;
  themes?: ('light' | 'dark')[]; // Optional: specify which themes to capture. Defaults to both.
  setup: (context: ScreenshotContext) => Promise<void>;
};

type ChildProcessHandle = {
  name: string;
  child: ReturnType<typeof spawn>;
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outputRoot = resolve(repoRoot, 'docs-site/static/img');
const screenshotServerPort = Number(process.env['SCREENSHOT_SERVER_PORT'] ?? '5073');
const screenshotWebPort = Number(process.env['SCREENSHOT_WEB_PORT'] ?? '5074');
const screenshotOnly = process.env['SCREENSHOT_ONLY']?.split(',').map(part => part.trim()).filter(Boolean) ?? [];
const webBaseUrl = `http://localhost:${screenshotWebPort}`;
const serverBaseUrl = `http://localhost:${screenshotServerPort}`;
const defaultViewport = { width: 1280, height: 800 } satisfies Viewport;
const defaultDeviceScaleFactor = process.platform === 'darwin' ? 2 : 1;
const projectDiagramName = 'Project overview draft';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const createBlankDiagramDocument = (name: string) => {
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

const openProjectNewDiagramDialog = async (page: Page) => {
  await page.getByRole('main').getByRole('button', { name: 'New' }).click();
  const newDiagramItem = page.getByRole('menuitem', { name: 'New diagram' });
  await expect(newDiagramItem).toBeVisible();
  await newDiagramItem.click();
  await expect(page.getByText('Choose a starting point')).toBeVisible();
};

const createBlankProjectDiagram = async (page: Page, name: string) => {
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

const markProjectDiagramAsTemplate = async (page: Page, name: string) => {
  await page.evaluate(
    async ({ workspaceSlug, projectId, diagramName }) => {
      const response = await fetch(
        `/api/${encodeURIComponent(workspaceSlug)}/projects/${encodeURIComponent(projectId)}/template-status?path=${encodeURIComponent(diagramName)}.json`,
        {
          method: 'PUT',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            is_template: true,
            is_workspace_template: false
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to promote diagram to template: ${response.status}`);
      }
    },
    {
      workspaceSlug: defaultWorkspace.slug,
      projectId: authMigrationProject.id,
      diagramName: name
    }
  );
};

const openDiagramEditorFromProject = async (page: Page, name: string) => {
  await page.getByRole('main').getByRole('button', { name: new RegExp(escapeRegExp(name)) }).first().click();
  await expect(page.locator('#awareness')).toBeVisible();
};

const createWikiPage = async (
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

const saveWikiContent = async (page: Page, nodeId: string, body: string) =>
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

const seedWikiPage = async (
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

const getLatestMarkdownRevisionId = async (page: Page, nodeId: string) =>
  await page.evaluate(
    async ({ workspaceSlug, nodeId }) => {
      const response = await fetch(
        `/api/${encodeURIComponent(workspaceSlug)}/markdown/${encodeURIComponent(nodeId)}/revisions`
      );
      if (!response.ok) {
        throw new Error(`Failed to list markdown revisions: ${response.status}`);
      }

      const revisions = (await response.json()) as Array<{ id: string }>;
      return revisions[0]?.id ?? null;
    },
    { workspaceSlug: defaultWorkspace.slug, nodeId }
  );

const env = {
  ...process.env,
  AUTH_MODE: 'local',
  DB_DRIVER: 'sqlite',
  JWT_SECRET: 'e2e-test-secret-must-be-at-least-32-chars!!',
  PNPM_WORKSPACE_DIR: repoRoot,
  SQLITE_PATH: '',
  STORAGE_BACKEND: 'fs',
  STORAGE_FS_BASE: ''
};

const screenshotConfigs: ScreenshotConfig[] = [
  {
    product: 'arch-register',
    category: 'workspace',
    name: 'selector-open',
    fullPage: false,
    setup: async ({ homePage }) => {
      await homePage.goto();
      await homePage.expectLoaded(defaultWorkspace.name);
      await homePage.workspaceShell.topBar.openWorkspaceSwitcher();
    }
  },
  {
    product: 'arch-register',
    category: 'workspace',
    name: 'create-dialog',
    selector: '[role="alertdialog"]',
    setup: async ({ homePage }) => {
      await homePage.goto();
      await homePage.expectLoaded(defaultWorkspace.name);
      await homePage.workspaceShell.topBar.openAddWorkspaceFromSwitcher();
    }
  },
  {
    product: 'arch-register',
    category: 'workspace',
    name: 'home-overview',
    fullPage: false,
    setup: async ({ homePage }) => {
      await homePage.goto();
      await homePage.expectLoaded(defaultWorkspace.name);
    }
  },
  {
    product: 'arch-register',
    category: 'entities',
    name: 'browser-overview',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto();
      await entitiesPage.expectLoaded();
    }
  },
  {
    product: 'arch-register',
    category: 'entities',
    name: 'browser-cards',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto({ viewMode: 'cards' });
      await entitiesPage.expectLoaded();
    }
  },
  {
    product: 'arch-register',
    category: 'entities',
    name: 'browser-tree',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto({ viewMode: 'tree' });
      await entitiesPage.expectLoaded();
    }
  },
  {
    product: 'arch-register',
    category: 'entities',
    name: 'detail-overview',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto();
      await entitiesPage.expectLoaded();
      await entitiesPage.openEntity(frontendAppEntity.name);
      await entitiesPage.expectEntityDetailLoaded(frontendAppEntity.name);
    }
  },
  {
    product: 'arch-register',
    category: 'entities',
    name: 'browser-radar',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto({ viewMode: 'radar' });
      await entitiesPage.expectLoaded();
      await expect(entitiesPage.browserTitle()).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'entities',
    name: 'create-dialog',
    selector: '[role="alertdialog"]',
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto();
      await entitiesPage.expectLoaded();
      await entitiesPage.openNewEntityDialog();
    }
  },
  {
    product: 'arch-register',
    category: 'entities',
    name: 'browser-timeline',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto({ viewMode: 'timeline' });
      await entitiesPage.expectLoaded();
      await expect(entitiesPage.browserTitle()).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'entities',
    name: 'browser-matrix',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto({ viewMode: 'matrix' });
      await entitiesPage.expectLoaded();
      await expect(entitiesPage.browserTitle()).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'entities',
    name: 'browser-explore',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto({ viewMode: 'explore' });
      await entitiesPage.expectLoaded();
      await expect(entitiesPage.browserTitle()).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'projects',
    name: 'list-overview',
    fullPage: false,
    setup: async ({ projectsPage }) => {
      await projectsPage.goto();
      await projectsPage.expectLoaded();
    }
  },
  {
    product: 'arch-register',
    category: 'projects',
    name: 'detail-home',
    fullPage: false,
    setup: async ({ projectsPage }) => {
      await projectsPage.gotoProject(authMigrationProject.id);
      await projectsPage.expectProjectOpened(authMigrationProject.name);
    }
  },
  {
    product: 'arch-register',
    category: 'projects',
    name: 'new-diagram-dialog',
    selector: '[role="alertdialog"]',
    setup: async ({ projectsPage }) => {
      await projectsPage.gotoProject(authMigrationProject.id);
      await projectsPage.expectProjectOpened(authMigrationProject.name);
      await openProjectNewDiagramDialog(projectsPage.page);
    }
  },
  {
    product: 'arch-register',
    category: 'search',
    name: 'results',
    fullPage: false,
    setup: async ({ searchPage }) => {
      await searchPage.goto();
      await searchPage.expectLoaded();
      await searchPage.search('auth');
      await searchPage.expectEntityResultsFound();
    }
  },
  {
    product: 'arch-register',
    category: 'content',
    name: 'workspace-overview',
    fullPage: false,
    setup: async ({ homePage }) => {
      await createWikiPage(homePage.page, 'workspace', 'Architecture notes');
      await homePage.page.goto(`/${defaultWorkspace.slug}/content`);
      await expect(homePage.page.getByText('Architecture notes').first()).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'content',
    name: 'project-diagram-editor',
    fullPage: false,
    setup: async ({ projectsPage }) => {
      await projectsPage.gotoProject(authMigrationProject.id);
      await createBlankProjectDiagram(projectsPage.page, projectDiagramName);
      await openDiagramEditorFromProject(projectsPage.page, projectDiagramName);
    }
  },
  {
    product: 'arch-register',
    category: 'ai',
    name: 'assistant-overview',
    fullPage: false,
    setup: async ({ homePage }) => {
      await homePage.page.goto(`/${defaultWorkspace.slug}/assistant`);
      await expect(homePage.page.getByText('Ask about your model', { exact: true })).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'ai',
    name: 'extract-overview',
    fullPage: false,
    setup: async ({ homePage }) => {
      await homePage.page.goto(`/${defaultWorkspace.slug}/extract`);
      await expect(homePage.page.getByRole('button', { name: 'Extract entities' })).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'account',
    name: 'profile',
    fullPage: false,
    setup: async ({ accountSettingsPage }) => {
      await accountSettingsPage.goto('profile');
      await accountSettingsPage.expectProfileLoaded();
    }
  },
  {
    product: 'arch-register',
    category: 'admin',
    name: 'settings-general',
    fullPage: false,
    setup: async ({ settingsPage }) => {
      await settingsPage.goto('general');
      await settingsPage.expectLoaded();
    }
  },
  {
    product: 'arch-register',
    category: 'admin',
    name: 'schema-editor',
    fullPage: false,
    setup: async ({ dataModelPage }) => {
      await dataModelPage.goto();
      await dataModelPage.expectLoaded();
      await dataModelPage.openSchemaType(apiSchema.name);
    }
  },
  {
    product: 'arch-register',
    category: 'admin',
    name: 'model-overview',
    fullPage: false,
    setup: async ({ settingsPage }) => {
      await settingsPage.page.goto(`/${defaultWorkspace.slug}/settings/model-overview`);
      await expect(settingsPage.page.getByText('Model Overview')).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'admin',
    name: 'teams',
    fullPage: false,
    setup: async ({ settingsPage }) => {
      await settingsPage.goto('teams');
      await expect(settingsPage.page.getByRole('heading', { name: 'Teams' })).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'admin',
    name: 'members',
    fullPage: false,
    setup: async ({ settingsPage }) => {
      await settingsPage.goto('members');
      await expect(settingsPage.page.getByRole('heading', { name: 'Members' })).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'admin',
    name: 'roles',
    fullPage: false,
    setup: async ({ settingsPage }) => {
      await settingsPage.goto('roles');
      await expect(settingsPage.page.getByRole('heading', { name: 'Roles & permissions' })).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'admin',
    name: 'ai',
    fullPage: false,
    setup: async ({ settingsPage }) => {
      await settingsPage.goto('ai');
      await expect(settingsPage.page.getByRole('heading', { name: 'AI' })).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'admin',
    name: 'export-import',
    fullPage: false,
    setup: async ({ settingsPage }) => {
      await settingsPage.goto('export-import');
      await expect(settingsPage.page.getByRole('heading', { name: 'Export & Import' })).toBeVisible();
    }
  }
];

const runCommand = async (command: string, args: string[], commandEnv: NodeJS.ProcessEnv) =>
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: commandEnv,
      stdio: 'inherit'
    });

    child.once('error', rejectPromise);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(
        new Error(
          `${command} ${args.join(' ')} exited with ${signal == null ? `code ${code}` : `signal ${signal}`}`
        )
      );
    });
  });

const startCommand = (name: string, command: string, args: string[], commandEnv: NodeJS.ProcessEnv) => {
  const child = spawn(command, args, {
    cwd: repoRoot,
    env: commandEnv,
    stdio: 'inherit'
  });

  const handle: ChildProcessHandle = { name, child };
  runningChildren.push(handle);
  return handle;
};

const runningChildren: ChildProcessHandle[] = [];

const terminateChild = async (handle: ChildProcessHandle) => {
  const { child, name } = handle;

  if (child.exitCode != null || child.signalCode != null) {
    return;
  }

  child.kill('SIGTERM');

  await new Promise<void>(resolvePromise => {
    const timeout = setTimeout(() => {
      if (child.exitCode == null && child.signalCode == null) {
        child.kill('SIGKILL');
      }
    }, 5_000);

    child.once('exit', () => {
      clearTimeout(timeout);
      resolvePromise();
    });
  });

  console.log(`Stopped ${name}`);
};

const waitForHttp = async (url: string, label: string, timeoutMs = 120_000) => {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`Unexpected status ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await sleep(500);
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError ?? 'unknown error');
  throw new Error(`Timed out waiting for ${label} at ${url}: ${message}`);
};

const captureScreenshot = async (page: Page, config: ScreenshotConfig, theme: 'light' | 'dark') => {
  const themes = config.themes ?? ['light', 'dark'];
  const themeSuffix = themes.length === 1 ? '' : `-${theme}`;
  const screenshotPath = resolve(outputRoot, config.product, config.category, `${config.name}${themeSuffix}.png`);
  await mkdir(dirname(screenshotPath), { recursive: true });

  if (config.selector != null) {
    const gap = config.selectorGap ?? 16;
    const element = page.locator(config.selector);
    const box = await element.boundingBox();
    if (box != null) {
      await page.screenshot({
        animations: 'disabled',
        caret: 'hide',
        clip: {
          x: Math.max(0, box.x - gap),
          y: Math.max(0, box.y - gap),
          width: box.width + gap * 2,
          height: box.height + gap * 2
        },
        path: screenshotPath
      });
    } else {
      await element.screenshot({ animations: 'disabled', caret: 'hide', path: screenshotPath });
    }
    return screenshotPath;
  }

  await page.screenshot({
    animations: 'disabled',
    caret: 'hide',
    fullPage: config.fullPage ?? true,
    path: screenshotPath
  });

  return screenshotPath;
};

const main = async () => {
  let tempRoot: string | undefined;
  let browser: Browser | undefined;
  tempRoot = await mkdtemp(join(tmpdir(), 'diagram-craft-docs-screenshots-'));
  const serverEnv = {
    ...env,
    PORT: String(screenshotServerPort),
    SQLITE_PATH: join(tempRoot, 'arch-register.sqlite'),
    STORAGE_FS_BASE: join(tempRoot, 'storage')
  };
  const webEnv = {
    ...process.env,
    PNPM_WORKSPACE_DIR: repoRoot,
    PORT: String(screenshotWebPort),
    VITE_AR_SERVER_PORT: String(screenshotServerPort)
  };

  try {
    console.log('Bootstrapping Arch Register dev data...');
    await runCommand('pnpm', ['--dir', 'arch-register-packages/server', 'bootstrap'], serverEnv);

    console.log('Starting Arch Register dev servers...');
    startCommand('arch-register-server', 'pnpm', ['--dir', 'arch-register-packages/server', 'start'], serverEnv);
    startCommand(
      'arch-register-web',
      'pnpm',
      ['--dir', 'arch-register-packages/web', 'dev', '--', '--strictPort', '--port', String(screenshotWebPort)],
      webEnv
    );

    await Promise.all([
      waitForHttp(`${serverBaseUrl}/api/auth/config`, 'Arch Register server'),
      waitForHttp(webBaseUrl, 'Arch Register web app')
    ]);

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      baseURL: webBaseUrl,
      colorScheme: 'light',
      deviceScaleFactor: defaultDeviceScaleFactor,
      locale: 'en-US',
      viewport: defaultViewport
    });
    
    const page = await context.newPage();

    const loginPage = new LoginPage(page);
    const homePage = new HomePage(page, defaultWorkspace.slug);
    const accountSettingsPage = new AccountSettingsPage(page, defaultWorkspace.slug);
    const entitiesPage = new EntitiesPage(page, defaultWorkspace.slug);
    const projectsPage = new ProjectsPage(page, defaultWorkspace.slug);
    const searchPage = new SearchPage(page, defaultWorkspace.slug);
    const settingsPage = new SettingsPage(page, defaultWorkspace.slug);
    const dataModelPage = new DataModelPage(page, defaultWorkspace.slug);

    await loginPage.goto();
    await loginPage.expectLoaded();
    await loginPage.signInAsSeededUser();
    await homePage.expectLoaded(defaultWorkspace.name);

    const screenshotContext = {
      accountSettingsPage,
      dataModelPage,
      entitiesPage,
      homePage,
      projectsPage,
      searchPage,
      settingsPage
    } satisfies ScreenshotContext;

    const filteredConfigs =
      screenshotOnly.length === 0
        ? screenshotConfigs
        : screenshotConfigs.filter(config =>
            screenshotOnly.some(filter => `${config.category}/${config.name}` === filter)
          );

    for (const config of filteredConfigs) {
      const themes = config.themes ?? ['light', 'dark'];
      const viewport = config.viewport ?? defaultViewport;
      
      for (const theme of themes) {
        console.log(`Capturing ${config.category}/${config.name} (${theme})...`);
        
        // Set theme in localStorage
        await page.evaluate((t) => {
          localStorage.setItem('ar-theme', t);
          localStorage.setItem('diagram-craft.user-state', JSON.stringify({ themeMode: t }));
        }, theme);
        
        // Reload page to apply theme
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        // Wait for theme to be applied to DOM
        await page.waitForFunction(
          (expectedTheme) => {
            const root = document.documentElement;
            if (expectedTheme === 'light') {
              return root.getAttribute('data-theme') === 'light' && !root.classList.contains('dark');
            } else {
              return !root.hasAttribute('data-theme') && root.classList.contains('dark');
            }
          },
          theme,
          { timeout: 5000 }
        );
        
        // Check if we need to re-authenticate after reload
        const isOnLoginPage = page.url().includes('/login');
        if (isOnLoginPage) {
          await loginPage.expectLoaded();
          await loginPage.signInAsSeededUser();
          await homePage.expectLoaded(defaultWorkspace.name);
        }
        
        // Set viewport and run setup
        await page.setViewportSize(viewport);
        await config.setup(screenshotContext);

        const screenshotPath = await captureScreenshot(page, config, theme);
        console.log(`Saved ${screenshotPath.replace(`${repoRoot}/`, '')}`);
      }
    }
  } finally {
    if (browser != null) {
      await browser.close();
    }

    for (const child of runningChildren.reverse()) {
      await terminateChild(child);
    }

    if (tempRoot != null) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }
};

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
