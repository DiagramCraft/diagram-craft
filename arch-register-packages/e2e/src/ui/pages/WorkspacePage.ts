import type { Page } from '@playwright/test';
import { WorkspaceShell } from '../components/WorkspaceShell';

export abstract class WorkspacePage {
  readonly page: Page;
  readonly workspaceSlug: string;
  readonly workspaceShell: WorkspaceShell;

  constructor(page: Page, workspaceSlug: string) {
    this.page = page;
    this.workspaceSlug = workspaceSlug;
    this.workspaceShell = new WorkspaceShell(page);
  }

  abstract goto(): Promise<void>;
}
