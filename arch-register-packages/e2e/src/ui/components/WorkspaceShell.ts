import { expect, type Locator, type Page } from '@playwright/test';
import { WorkspaceTopBar } from './WorkspaceTopBar';

export type WorkspaceNavView = 'home' | 'projects' | 'entities' | 'model' | 'search';

const navLabels: Record<WorkspaceNavView, string> = {
  home: 'Workspace overview',
  projects: 'Projects',
  entities: 'Entities',
  model: 'Data model',
  search: 'Search'
};

export class WorkspaceShell {
  readonly page: Page;
  readonly topBar: WorkspaceTopBar;

  constructor(page: Page) {
    this.page = page;
    this.topBar = new WorkspaceTopBar(page);
  }

  navButton = (view: WorkspaceNavView): Locator => this.page.getByLabel(navLabels[view]);

  openNav = async (view: WorkspaceNavView) => {
    await this.navButton(view).click();
  };

  expectActiveNav = async (view: WorkspaceNavView) => {
    await expect(this.navButton(view)).toHaveAttribute('aria-pressed', 'true');
  };

  expectMainVisible = async () => {
    await expect(this.page.getByRole('main')).toBeVisible();
  };
}
