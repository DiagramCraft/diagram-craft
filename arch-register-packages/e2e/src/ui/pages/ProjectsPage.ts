import { expect, type Page } from '@playwright/test';
import { workspaceProjectsRoute } from '../support/routes';
import { WorkspacePage } from './WorkspacePage';

export class ProjectsPage extends WorkspacePage {
  constructor(page: Page, workspaceSlug: string) {
    super(page, workspaceSlug);
  }

  goto = async () => {
    await this.page.goto(workspaceProjectsRoute(this.workspaceSlug));
  };

  openProject = async (name: string) => {
    await this.workspaceShell.openNav('projects');
    await this.expectProjectOpened(name);
  };

  expectLoaded = async () => {
    await this.workspaceShell.expectActiveNav('projects');
    await this.workspaceShell.expectMainVisible();
  };

  expectProjectOpened = async (name: string) => {
    await this.expectLoaded();
    await expect(this.page.getByRole('main').getByRole('heading', { name })).toBeVisible();
  };
}
