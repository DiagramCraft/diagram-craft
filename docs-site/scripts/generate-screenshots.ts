import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium, type Browser, type Page } from '@playwright/test';
import { DataModelPage } from '../../arch-register-packages/e2e/src/ui/pages/DataModelPage';
import { EntitiesPage } from '../../arch-register-packages/e2e/src/ui/pages/EntitiesPage';
import { HomePage } from '../../arch-register-packages/e2e/src/ui/pages/HomePage';
import { LoginPage } from '../../arch-register-packages/e2e/src/ui/pages/LoginPage';
import { ProjectsPage } from '../../arch-register-packages/e2e/src/ui/pages/ProjectsPage';
import { SearchPage } from '../../arch-register-packages/e2e/src/ui/pages/SearchPage';
import { SettingsPage } from '../../arch-register-packages/e2e/src/ui/pages/SettingsPage';
import { authMigrationProject } from '../../arch-register-packages/e2e/src/ui/support/projects';
import { frontendAppEntity } from '../../arch-register-packages/e2e/src/ui/support/entities';
import { apiSchema, componentSchema } from '../../arch-register-packages/e2e/src/ui/support/schemas';
import { defaultWorkspace } from '../../arch-register-packages/e2e/src/ui/support/workspaces';

type Viewport = {
  width: number;
  height: number;
};

type ScreenshotContext = {
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
const webBaseUrl = `http://localhost:${screenshotWebPort}`;
const serverBaseUrl = `http://localhost:${screenshotServerPort}`;
const defaultViewport = { width: 1280, height: 800 } satisfies Viewport;
const defaultDeviceScaleFactor = process.platform === 'darwin' ? 2 : 1;

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
    name: 'home-overview',
    setup: async ({ homePage }) => {
      await homePage.goto();
      await homePage.expectLoaded(defaultWorkspace.name);
    }
  },
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
    name: 'browser-filtered',
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto();
      await entitiesPage.expectLoaded();
      await entitiesPage.filterByType(apiSchema.name);
      await entitiesPage.expectFilteredResultCount(2);
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
    name: 'detail-edit',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto();
      await entitiesPage.expectLoaded();
      await entitiesPage.openEntity(frontendAppEntity.name);
      await entitiesPage.expectEntityDetailLoaded(frontendAppEntity.name);
      await entitiesPage.startEditingEntity();
    }
  },
  {
    product: 'arch-register',
    category: 'projects',
    name: 'list',
    setup: async ({ projectsPage }) => {
      await projectsPage.goto();
      await projectsPage.expectLoaded();
    }
  },
  {
    product: 'arch-register',
    category: 'projects',
    name: 'auth-migration-detail',
    setup: async ({ projectsPage }) => {
      await projectsPage.gotoProject(authMigrationProject.id);
      await projectsPage.expectProjectOpened(authMigrationProject.name);
    }
  },
  {
    product: 'arch-register',
    category: 'search',
    name: 'results',
    setup: async ({ searchPage }) => {
      await searchPage.goto();
      await searchPage.expectLoaded();
      await searchPage.search('API');
      await searchPage.expectEntityResultsFound();
      await searchPage.expectResultVisible('Auth API');
    }
  },
  {
    product: 'arch-register',
    category: 'settings',
    name: 'general',
    setup: async ({ settingsPage }) => {
      await settingsPage.goto();
      await settingsPage.expectLoaded();
    }
  },
  {
    product: 'arch-register',
    category: 'data-model',
    name: 'editor',
    setup: async ({ dataModelPage }) => {
      await dataModelPage.goto();
      await dataModelPage.expectLoaded();
      await dataModelPage.openSchemaType(componentSchema.name);
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

const captureScreenshot = async (page: Page, config: ScreenshotConfig) => {
  const screenshotPath = resolve(outputRoot, config.product, config.category, `${config.name}.png`);
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
      dataModelPage,
      entitiesPage,
      homePage,
      projectsPage,
      searchPage,
      settingsPage
    } satisfies ScreenshotContext;

    for (const config of screenshotConfigs) {
      const viewport = config.viewport ?? defaultViewport;
      console.log(`Capturing ${config.category}/${config.name}...`);
      await page.setViewportSize(viewport);
      await config.setup(screenshotContext);

      const screenshotPath = await captureScreenshot(page, config);
      console.log(`Saved ${screenshotPath.replace(`${repoRoot}/`, '')}`);
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
