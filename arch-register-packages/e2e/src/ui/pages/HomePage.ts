import { expect, type Page } from '@playwright/test';
import { workspaceHomeRoute } from '../support/routes';
import { WorkspacePage } from './WorkspacePage';

export class HomePage extends WorkspacePage {
  constructor(page: Page, workspaceSlug: string) {
    super(page, workspaceSlug);
  }

  goto = async () => {
    await this.page.goto(workspaceHomeRoute(this.workspaceSlug));
  };

  expectLoaded = async (workspaceName: string) => {
    await this.workspaceShell.expectActiveNav('home');
    await this.workspaceShell.expectMainVisible();
    await expect(this.page.getByRole('main').getByText(workspaceName, { exact: true })).toBeVisible();
    await expect(this.page.getByText('Entities').first()).toBeVisible();
    await expect(this.page.getByText('Projects').first()).toBeVisible();
  };
}
