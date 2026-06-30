import type { Page } from '@playwright/test';
import type { AccountSettingsPage } from '../../arch-register-packages/e2e/src/ui/pages/AccountSettingsPage';
import type { DataModelPage } from '../../arch-register-packages/e2e/src/ui/pages/DataModelPage';
import type { EntitiesPage } from '../../arch-register-packages/e2e/src/ui/pages/EntitiesPage';
import type { HomePage } from '../../arch-register-packages/e2e/src/ui/pages/HomePage';
import type { ProjectsPage } from '../../arch-register-packages/e2e/src/ui/pages/ProjectsPage';
import type { SearchPage } from '../../arch-register-packages/e2e/src/ui/pages/SearchPage';
import type { SettingsPage } from '../../arch-register-packages/e2e/src/ui/pages/SettingsPage';

export type Viewport = {
  width: number;
  height: number;
};

export type ScreenshotContext = {
  accountSettingsPage: AccountSettingsPage;
  homePage: HomePage;
  entitiesPage: EntitiesPage;
  projectsPage: ProjectsPage;
  searchPage: SearchPage;
  settingsPage: SettingsPage;
  dataModelPage: DataModelPage;
};

export type DiagramCraftScreenshotContext = {
  page: Page;
};

type BaseScreenshotConfig = {
  category: string;
  name: string;
  viewport?: Viewport;
  clip?: { x: number; y: number; width: number; height: number };
  selector?: string;
  selectorGap?: number;
  fullPage?: boolean;
  themes?: ('light' | 'dark')[];
};

export type ArchRegisterScreenshotConfig = BaseScreenshotConfig & {
  product: 'arch-register';
  setup: (context: ScreenshotContext) => Promise<void>;
};

export type DiagramCraftScreenshotConfig = BaseScreenshotConfig & {
  product: 'diagram-craft';
  setup: (context: DiagramCraftScreenshotContext) => Promise<void>;
};

export type ScreenshotConfig = ArchRegisterScreenshotConfig | DiagramCraftScreenshotConfig;
