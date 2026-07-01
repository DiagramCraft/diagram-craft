import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rename, rm, stat, unlink } from 'node:fs/promises';
import { promisify } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { type Browser, chromium, type Page } from '@playwright/test';
import { AccountSettingsPage } from '../../arch-register-packages/e2e/src/ui/pages/AccountSettingsPage';
import { DataModelPage } from '../../arch-register-packages/e2e/src/ui/pages/DataModelPage';
import { EntitiesPage } from '../../arch-register-packages/e2e/src/ui/pages/EntitiesPage';
import { HomePage } from '../../arch-register-packages/e2e/src/ui/pages/HomePage';
import { LoginPage } from '../../arch-register-packages/e2e/src/ui/pages/LoginPage';
import { ProjectsPage } from '../../arch-register-packages/e2e/src/ui/pages/ProjectsPage';
import { SearchPage } from '../../arch-register-packages/e2e/src/ui/pages/SearchPage';
import { SettingsPage } from '../../arch-register-packages/e2e/src/ui/pages/SettingsPage';
import { defaultWorkspace } from '../../arch-register-packages/e2e/src/ui/support/workspaces';
import type {
  ArchRegisterScreenshotConfig,
  DiagramCraftScreenshotConfig,
  DiagramCraftScreenshotContext,
  ScreenshotConfig,
  ScreenshotContext,
  Viewport
} from './screenshot-types.js';
import { discoverManifests } from './screenshot-manifest.js';
import {
  setDiagramCraftTheme,
  setStoredThemes,
  waitForThemeApplied
} from './screenshot-helpers.js';

type ChildProcessHandle = {
  name: string;
  child: ReturnType<typeof spawn>;
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outputRoot = resolve(repoRoot, 'docs-site/static/img');
const screenshotServerPort = Number(process.env['SCREENSHOT_SERVER_PORT'] ?? '5073');
const screenshotWebPort = Number(process.env['SCREENSHOT_WEB_PORT'] ?? '5074');
const diagramCraftScreenshotPort = Number(process.env['SCREENSHOT_DIAGRAM_CRAFT_PORT'] ?? '5175');
const screenshotOnly =
  process.env['SCREENSHOT_ONLY']
    ?.split(',')
    .map(part => part.trim())
    .filter(Boolean) ?? [];
const webBaseUrl = `http://localhost:${screenshotWebPort}`;
const serverBaseUrl = `http://localhost:${screenshotServerPort}`;
const diagramCraftBaseUrl = `http://localhost:${diagramCraftScreenshotPort}`;
const defaultViewport = { width: 1280, height: 800 } satisfies Viewport;
const defaultDeviceScaleFactor = process.platform === 'darwin' ? 2 : 1;
const projectDiagramName = 'Project overview draft';
const diagramCraftUserState = {
  panelLeft: 0,
  panelLeftWidth: 320,
  panelRight: -1,
  showHelp: false,
  stencilPickerViewMode: 'grid',
  stencilSearchAllPackages: false,
  stencils: [{ id: 'default', isOpen: true }],
  toolWindowTabs: { picker: 'picker' }
} as const;

const execFileAsync = promisify(execFile);
const pixelDiffThreshold = Number(process.env['SCREENSHOT_PIXEL_THRESHOLD'] ?? '5');

const compareImages = async (existingPath: string, newPath: string): Promise<number | null> => {
  try {
    await execFileAsync('compare', ['-metric', 'AE', existingPath, newPath, '/dev/null']);
    return 0;
  } catch (err: unknown) {
    if (err != null && typeof err === 'object' && 'stderr' in err) {
      const match = String((err as { stderr: unknown }).stderr).match(/^(\d+)/);
      if (match != null) return Number(match[1]);
    }
    return null;
  }
};

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

// All screenshot configs have been migrated to colocated manifests in docs/**/screenshots.ts
const screenshotConfigs: ScreenshotConfig[] = [];

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

const startCommand = (
  name: string,
  command: string,
  args: string[],
  commandEnv: NodeJS.ProcessEnv
) => {
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

  const message =
    lastError instanceof Error ? lastError.message : String(lastError ?? 'unknown error');
  throw new Error(`Timed out waiting for ${label} at ${url}: ${message}`);
};

const getThemes = (config: ScreenshotConfig) => config.themes ?? ['light', 'dark'];

const matchesScreenshotFilter = (config: ScreenshotConfig, filter: string) =>
  [
    `${config.product}/${config.category}/${config.name}`,
    `${config.category}/${config.name}`,
    config.name
  ].includes(filter);

const getFilteredConfigs = <T extends ScreenshotConfig>(configs: T[]) =>
  screenshotOnly.length === 0
    ? configs
    : configs.filter(config =>
        screenshotOnly.some(filter => matchesScreenshotFilter(config, filter))
      );

const captureScreenshot = async (page: Page, config: ScreenshotConfig, theme: 'light' | 'dark') => {
  const themes = getThemes(config);
  const themeSuffix = themes.length === 1 ? '' : `-${theme}`;
  const screenshotPath = resolve(
    outputRoot,
    config.product,
    config.category,
    `${config.name}${themeSuffix}.png`
  );
  await mkdir(dirname(screenshotPath), { recursive: true });
  const tempPath = `${screenshotPath}.tmp.png`;

  if (config.clip != null) {
    await page.screenshot({
      animations: 'disabled',
      caret: 'hide',
      clip: config.clip,
      path: tempPath
    });
  } else if (config.selector != null) {
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
        path: tempPath
      });
    } else {
      await element.screenshot({ animations: 'disabled', caret: 'hide', path: tempPath });
    }
  } else {
    await page.screenshot({
      animations: 'disabled',
      caret: 'hide',
      fullPage: config.fullPage ?? true,
      path: tempPath
    });
  }

  let pixelDiff: number | null = null;
  try {
    await stat(screenshotPath);
    pixelDiff = await compareImages(screenshotPath, tempPath);
  } catch {
    // existing file absent — always write
  }

  if (pixelDiff === null || pixelDiff > pixelDiffThreshold) {
    await rename(tempPath, screenshotPath);
    const reason = pixelDiff === null ? 'new file or size mismatch' : `${pixelDiff} pixels changed`;
    console.log(`  Written (${reason})`);
  } else {
    await unlink(tempPath);
    console.log(`  Skipped (${pixelDiff} pixels changed, threshold ${pixelDiffThreshold})`);
  }

  return screenshotPath;
};

const runArchRegisterScreenshots = async (configs: ArchRegisterScreenshotConfig[]) => {
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
    startCommand(
      'arch-register-server',
      'pnpm',
      ['--dir', 'arch-register-packages/server', 'start'],
      serverEnv
    );
    startCommand(
      'arch-register-web',
      'pnpm',
      [
        '--dir',
        'arch-register-packages/web',
        'dev',
        '--',
        '--strictPort',
        '--port',
        String(screenshotWebPort)
      ],
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

    for (const config of configs) {
      const themes = getThemes(config);
      const viewport = config.viewport ?? defaultViewport;

      for (const theme of themes) {
        const manifestSource = '_manifestSource' in config ? ` [${config._manifestSource}]` : '';
        console.log(`Capturing ${config.category}/${config.name} (${theme})...${manifestSource}`);

        await setStoredThemes(page, theme);
        await page.reload();
        await page.waitForLoadState('networkidle');

        await waitForThemeApplied(page, theme);

        const isOnLoginPage = page.url().includes('/login');
        if (isOnLoginPage) {
          await loginPage.expectLoaded();
          await loginPage.signInAsSeededUser();
          await homePage.expectLoaded(defaultWorkspace.name);
        }

        await page.setViewportSize(viewport);
        await config.setup(screenshotContext);
        await waitForThemeApplied(page, theme);

        const screenshotPath = await captureScreenshot(page, config, theme);
        console.log(`Saved ${screenshotPath.replace(`${repoRoot}/`, '')}`);
      }
    }
  } finally {
    if (browser != null) {
      await browser.close();
    }

    if (tempRoot != null) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }
};

const runDiagramCraftScreenshots = async (configs: DiagramCraftScreenshotConfig[]) => {
  let browser: Browser | undefined;

  try {
    console.log('Starting Diagram Craft dev server...');
    startCommand(
      'diagram-craft-web',
      'pnpm',
      [
        '--dir',
        'packages/main',
        'dev',
        '--strictPort',
        '--port',
        String(diagramCraftScreenshotPort)
      ],
      { ...process.env, PNPM_WORKSPACE_DIR: repoRoot }
    );

    await waitForHttp(diagramCraftBaseUrl, 'Diagram Craft web app');

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      baseURL: diagramCraftBaseUrl,
      colorScheme: 'light',
      deviceScaleFactor: defaultDeviceScaleFactor,
      locale: 'en-US',
      viewport: defaultViewport
    });

    await context.addInitScript(state => {
      const current = JSON.parse(localStorage.getItem('diagram-craft.user-state') ?? '{}');
      localStorage.setItem(
        'diagram-craft.user-state',
        JSON.stringify({
          ...current,
          ...state
        })
      );
    }, diagramCraftUserState);

    const page = await context.newPage();
    const screenshotContext = { page } satisfies DiagramCraftScreenshotContext;

    for (const config of configs) {
      const themes = getThemes(config);
      const viewport = config.viewport ?? defaultViewport;

      for (const theme of themes) {
        const manifestSource = '_manifestSource' in config ? ` [${config._manifestSource}]` : '';
        console.log(
          `Capturing ${config.product}/${config.category}/${config.name} (${theme})...${manifestSource}`
        );
        await setDiagramCraftTheme(page, theme);
        await page.setViewportSize(viewport);
        await config.setup(screenshotContext);
        await waitForThemeApplied(page, theme);

        const screenshotPath = await captureScreenshot(page, config, theme);
        console.log(`Saved ${screenshotPath.replace(`${repoRoot}/`, '')}`);
      }
    }
  } finally {
    if (browser != null) {
      await browser.close();
    }
  }
};

const main = async () => {
  // Discover manifests from docs tree
  const manifestConfigs = await discoverManifests();
  console.log(`Discovered ${manifestConfigs.length} screenshot(s) from manifests`);

  // Merge with existing hardcoded configs
  const allConfigs = [...screenshotConfigs, ...manifestConfigs];

  const filteredConfigs = getFilteredConfigs(allConfigs);
  const archRegisterConfigs = filteredConfigs.filter(
    config => config.product === 'arch-register'
  ) as ArchRegisterScreenshotConfig[];
  const diagramCraftConfigs = filteredConfigs.filter(
    config => config.product === 'diagram-craft'
  ) as DiagramCraftScreenshotConfig[];

  try {
    if (archRegisterConfigs.length > 0) {
      await runArchRegisterScreenshots(archRegisterConfigs);
    }

    if (diagramCraftConfigs.length > 0) {
      await runDiagramCraftScreenshots(diagramCraftConfigs);
    }
  } finally {
    for (const child of runningChildren.reverse()) {
      await terminateChild(child);
    }
  }
};

main().catch(error => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
