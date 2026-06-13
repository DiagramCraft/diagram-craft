import { expect, test } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { authMigrationProject, checkoutRevampProject, portalRedesignProject } from '../support/projects';
import { defaultWorkspace } from '../support/workspaces';

test.describe('projects section', () => {
  test('opens the projects section without pre-selecting a project from the workspace rail', async ({ page }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);
    const projectsPage = new ProjectsPage(page, defaultWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(defaultWorkspace.name);
    await homePage.expectProjectVisible(authMigrationProject.name);
    await projectsPage.workspaceShell.openNav('projects');
    await projectsPage.expectNoProjectSelected();
  });

  test('pins a project into the pinned section and then unpins it', async ({ page }) => {
    const projectsPage = new ProjectsPage(page, defaultWorkspace.slug);

    await projectsPage.gotoProject(portalRedesignProject.id);
    await projectsPage.expectProjectOpened(portalRedesignProject.name);
    await projectsPage.expectProjectInSidebarGroup('Active Projects', portalRedesignProject.name);
    await projectsPage.expectProjectNotInSidebarGroup('Pinned Projects', portalRedesignProject.name);

    try {
      await projectsPage.togglePinned();
      await projectsPage.expectProjectInSidebarGroup('Pinned Projects', portalRedesignProject.name);
      await projectsPage.expectProjectNotInSidebarGroup('Active Projects', portalRedesignProject.name);
    } finally {
      if ((await projectsPage.pinProjectButton().getAttribute('aria-label')) === 'Unpin project') {
        await projectsPage.togglePinned();
      }
    }

    await projectsPage.expectProjectInSidebarGroup('Active Projects', portalRedesignProject.name);
    await projectsPage.expectProjectNotInSidebarGroup('Pinned Projects', portalRedesignProject.name);
  });

  test('switches between active projects from the sidebar', async ({ page }) => {
    const projectsPage = new ProjectsPage(page, defaultWorkspace.slug);

    await projectsPage.gotoProject(portalRedesignProject.id);
    await projectsPage.expectProjectOpened(portalRedesignProject.name);
    await projectsPage.expectProjectInSidebarGroup('Active Projects', checkoutRevampProject.name);

    await projectsPage.openProjectFromSidebar(checkoutRevampProject.name);
    await projectsPage.openProjectFromSidebar(portalRedesignProject.name);
  });

  test('switches to entities from the secondary sidebar', async ({ page }) => {
    const projectsPage = new ProjectsPage(page, defaultWorkspace.slug);

    await projectsPage.gotoProject(authMigrationProject.id);
    await projectsPage.expectProjectOpened(authMigrationProject.name);
    await projectsPage.openEntitiesSection();

    await expect(projectsPage.secondaryEntitiesRow()).toBeVisible();
    await expect(projectsPage.addEntityButton()).toBeVisible();
    await expect(projectsPage.entitiesSectionLabel()).toBeVisible();
  });

  test('shows the edit project dialog from the project page', async ({ page }) => {
    const projectsPage = new ProjectsPage(page, defaultWorkspace.slug);

    await projectsPage.gotoProject(authMigrationProject.id);
    await projectsPage.expectProjectOpened(authMigrationProject.name);
    await projectsPage.openEditProjectDialog();
  });

  test('creates a new project from the sidebar action', async ({ page }) => {
    const projectsPage = new ProjectsPage(page, defaultWorkspace.slug);
    const projectName = `Sidebar Project ${Date.now()}`;

    await projectsPage.gotoProject(portalRedesignProject.id);
    await projectsPage.expectProjectOpened(portalRedesignProject.name);
    await projectsPage.openAddProjectDialog();
    await projectsPage.createProject({ name: projectName });
    await projectsPage.expectProjectOpened(projectName);
    await projectsPage.expectProjectInSidebarGroup('Active Projects', projectName);
  });
});
