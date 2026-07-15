import { expect } from '@playwright/test';
import { projectDetailRoute, workspaceProjectsRoute } from '../support/routes';
import { WorkspacePage } from './WorkspacePage';

type CreateProjectInput = {
  name: string;
};

export class ProjectsPage extends WorkspacePage {
  private readonly primarySidebarStorageKey = 'ar-workspace-primary-sidebar-mode';

  goto = async () => {
    await this.page.goto(workspaceProjectsRoute(this.workspaceSlug));
  };

  gotoProject = async (projectId: string, tab: 'projects' | 'archive' = 'projects') => {
    await this.page.addInitScript(({ key, value }) => window.localStorage.setItem(key, value), {
      key: this.primarySidebarStorageKey,
      value: 'expanded'
    });
    await this.page.goto(projectDetailRoute(this.workspaceSlug, projectId, tab));
  };

  pinProjectButton = () => this.page.getByRole('button', { name: /Pin project|Unpin project/ });

  editProjectButton = () => this.page.getByRole('button', { name: 'Edit' });

  newProjectButton = () => this.page.locator('button[title="New project"]');

  addProjectDialog = () => this.page.getByRole('alertdialog', { name: 'New project' });

  createProjectButton = () => this.page.getByRole('button', { name: 'Create project' });

  sidebarGroup = (title: 'Pinned Projects' | 'Active Projects' | 'Archived Projects') =>
    this.page.getByTestId(`project-group-${title}`);

  sidebarProjectRow = (name: string) => this.page.getByTestId(`project-row-${name}`);
  secondaryHomeRow = () => this.page.getByTestId('project-secondary-home');
  secondaryEntitiesRow = () => this.page.getByTestId('project-secondary-entities');
  emptySelectionTitle = () => this.page.getByText('Select a project');
  addEntityButton = () =>
    this.page.getByRole('main').getByRole('button', { name: 'Add entity' }).first();
  entitiesSectionLabel = () => this.page.getByRole('main').getByText(/^Entities \(/);

  openProject = async (name: string) => {
    await this.workspaceShell.openNav('projects');
    await this.sidebarProjectRow(name).click();
    await this.expectProjectOpened(name);
  };

  expectLoaded = async () => {
    await this.workspaceShell.expectActiveNav('projects');
    await this.workspaceShell.expectMainVisible();
  };

  expectNoProjectSelected = async () => {
    await this.expectLoaded();
    await expect(this.emptySelectionTitle()).toBeVisible();
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
    await expect(
      this.sidebarGroup(groupTitle).getByTestId(`project-row-${projectName}`)
    ).toBeVisible();
  };

  expectProjectNotInSidebarGroup = async (
    groupTitle: 'Pinned Projects' | 'Active Projects' | 'Archived Projects',
    projectName: string
  ) => {
    await expect(
      this.sidebarGroup(groupTitle).getByTestId(`project-row-${projectName}`)
    ).toHaveCount(0);
  };

  openProjectFromSidebar = async (projectName: string) => {
    await this.sidebarProjectRow(projectName).click();
    await this.expectProjectOpened(projectName);
  };

  openEntitiesSection = async () => {
    await this.secondaryEntitiesRow().click();
  };

  openHomeSection = async () => {
    await this.secondaryHomeRow().click();
  };

  openEditProjectDialog = async () => {
    await this.editProjectButton().click();
    await expect(this.page.getByRole('alertdialog', { name: 'Edit project' })).toBeVisible();
  };

  openAddProjectDialog = async () => {
    await this.newProjectButton().click();
    await expect(this.addProjectDialog()).toBeVisible();
  };

  createProject = async ({ name }: CreateProjectInput) => {
    const dialog = this.addProjectDialog();

    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder('e.g. Checkout Modernization').fill(name);
    await this.createProjectButton().click();
  };
}
