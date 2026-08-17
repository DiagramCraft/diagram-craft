import type { Page } from '@playwright/test';
import { WorkspaceShell } from '../components/WorkspaceShell';
import { LoginPage } from './LoginPage';

export abstract class WorkspacePage {
  readonly page: Page;
  readonly workspaceSlug: string;
  readonly workspaceShell: WorkspaceShell;

  constructor(page: Page, workspaceSlug: string) {
    this.page = page;
    this.workspaceSlug = workspaceSlug;
    this.workspaceShell = new WorkspaceShell(page);
  }

  gotoAuthenticated = async (path: string) => {
    await this.page.goto(path);
    if (!new URL(this.page.url()).pathname.endsWith('/login')) return;

    const loginPage = new LoginPage(this.page);
    await loginPage.signInAsSeededUser();
    await this.page.waitForURL(url => !url.pathname.endsWith('/login'));
    await this.page.goto(path);
  };

  abstract goto(): Promise<void>;
}
