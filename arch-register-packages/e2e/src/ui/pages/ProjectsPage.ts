import { expect, type Page } from '@playwright/test';
import { projectDetailRoute, workspaceProjectsRoute } from '../support/routes';
import { WorkspacePage } from './WorkspacePage';

export class ProjectsPage extends WorkspacePage {
  constructor(page: Page, workspaceSlug: string) {
    super(page, workspaceSlug);
  }

  goto = async () => {
    await this.page.goto(workspaceProjectsRoute(this.workspaceSlug));
  };

  gotoProject = async (projectId: string, tab: 'projects' | 'archive' = 'projects') => {
    await this.page.goto(projectDetailRoute(this.workspaceSlug, projectId, tab));
  };

  pinProjectButton = () =>
    this.page.getByRole('button', { name: /Pin project|Unpin project/ });

  editProjectButton = () => this.page.getByRole('button', { name: 'Edit' });

  sidebarGroup = (title: 'Pinned Projects' | 'Active Projects' | 'Archived Projects') =>
    this.page.getByLabel(title);

  sidebarProjectRow = (name: string) => this.page.getByLabel(`Project row: ${name}`);

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

  togglePinned = async () => {
    const currentLabel = await this.pinProjectButton().getAttribute('aria-label');
    await this.pinProjectButton().click();
    const expectedNextLabel = currentLabel === 'Pin project' ? 'Unpin project' : 'Pin project';
    await expect(this.pinProjectButton()).toHaveAttribute('aria-label', expectedNextLabel);
  };

  expectProjectInSidebarGroup = async (
    groupTitle: 'Pinned Projects' | 'Active Projects' | 'Archived Projects',
    projectName: string
  ) => {
    await expect(this.sidebarGroup(groupTitle).getByLabel(`Project row: ${projectName}`)).toBeVisible();
  };

  expectProjectNotInSidebarGroup = async (
    groupTitle: 'Pinned Projects' | 'Active Projects' | 'Archived Projects',
    projectName: string
  ) => {
    await expect(this.sidebarGroup(groupTitle).getByLabel(`Project row: ${projectName}`)).toHaveCount(0);
  };

  openProjectFromSidebar = async (projectName: string) => {
    await this.sidebarProjectRow(projectName).click();
    await this.expectProjectOpened(projectName);
  };

  openEditProjectDialog = async () => {
    await this.editProjectButton().click();
    await expect(this.page.getByRole('alertdialog', { name: 'Edit project' })).toBeVisible();
  };
}
