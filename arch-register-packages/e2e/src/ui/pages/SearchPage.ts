import { expect, type Page } from '@playwright/test';
import { workspaceSearchRoute } from '../support/routes';
import { WorkspacePage } from './WorkspacePage';

export class SearchPage extends WorkspacePage {
  constructor(page: Page, workspaceSlug: string) {
    super(page, workspaceSlug);
  }

  goto = async () => {
    await this.page.goto(workspaceSearchRoute(this.workspaceSlug));
  };

  expectLoaded = async () => {
    await this.workspaceShell.expectActiveNav('search');
    await expect(this.page.getByPlaceholder('Search entities, diagrams, projects, schema…')).toBeVisible();
    await expect(this.page.getByText('Start typing to search across the workspace.')).toBeVisible();
  };
}
