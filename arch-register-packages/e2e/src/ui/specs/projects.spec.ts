import { expect, test } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { ProjectsPage } from '../pages/ProjectsPage';
import {
  authMigrationProject,
  checkoutRevampProject,
  portalRedesignProject
} from '../support/projects';
import { defaultWorkspace } from '../support/workspaces';

test.describe('projects section', () => {
  test('opens the projects section without pre-selecting a project from the workspace rail @quick', async ({
    page
  }) => {
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
    await projectsPage.expectProjectNotInSidebarGroup(
      'Pinned Projects',
      portalRedesignProject.name
    );

    try {
      await projectsPage.togglePinned();
      await projectsPage.expectProjectInSidebarGroup('Pinned Projects', portalRedesignProject.name);
      await projectsPage.expectProjectNotInSidebarGroup(
        'Active Projects',
        portalRedesignProject.name
      );
    } finally {
      if ((await projectsPage.pinProjectButton().getAttribute('aria-label')) === 'Unpin project') {
        await projectsPage.togglePinned();
      }
    }

    await projectsPage.expectProjectInSidebarGroup('Active Projects', portalRedesignProject.name);
    await projectsPage.expectProjectNotInSidebarGroup(
      'Pinned Projects',
      portalRedesignProject.name
    );
  });

  test('switches between active projects from the sidebar @quick', async ({ page }) => {
    const projectsPage = new ProjectsPage(page, defaultWorkspace.slug);

    await projectsPage.gotoProject(portalRedesignProject.id);
    await projectsPage.expectProjectOpened(portalRedesignProject.name);
    await projectsPage.expectProjectInSidebarGroup('Active Projects', checkoutRevampProject.name);

    await projectsPage.openProjectFromSidebar(checkoutRevampProject.name);
    await projectsPage.openProjectFromSidebar(portalRedesignProject.name);
  });

  test('switches to entities from the secondary sidebar @quick', async ({ page }) => {
    const projectsPage = new ProjectsPage(page, defaultWorkspace.slug);

    await projectsPage.gotoProject(authMigrationProject.id);
    await projectsPage.expectProjectOpened(authMigrationProject.name);
    await projectsPage.openEntitiesSection();

    await expect(projectsPage.secondaryEntitiesRow()).toBeVisible();
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

  test('restores project content filter and view mode without colliding with entity browser params', async ({
    page
  }) => {
    await page.goto(
      `/${defaultWorkspace.slug}/projects/${authMigrationProject.id}?tab=projects&section=home&q=auth&viewMode=timeline`
    );

    const filterInput = page.getByPlaceholder('Filter diagrams…');
    const listViewButton = page.locator('button[title="List view"]');
    const gridViewButton = page.locator('button[title="Grid view"]');

    await filterInput.fill('migration');
    await listViewButton.click();

    await expect(page).toHaveURL(/q=auth/);
    await expect(page).toHaveURL(/viewMode=timeline/);
    await expect(page).toHaveURL(/contentQuery=migration/);
    await expect(page).toHaveURL(/contentView=list/);

    await page.reload();
    await expect(filterInput).toHaveValue('migration');
    await expect(listViewButton).toHaveClass(/iconBtnActive/);
    await expect(gridViewButton).not.toHaveClass(/iconBtnActive/);

    await page.goBack();
    await expect(filterInput).toHaveValue('migration');
    await expect(page).not.toHaveURL(/contentView=list/);
    await expect(page).toHaveURL(/q=auth/);
    await expect(page).toHaveURL(/viewMode=timeline/);
    await expect(gridViewButton).toHaveClass(/iconBtnActive/);
  });

  test('navigates directly to project content folders, including nested folders', async ({
    page
  }) => {
    await page.goto(
      `/${defaultWorkspace.slug}/projects/${authMigrationProject.id}/folders/Test?contentQuery=migration&contentView=list`
    );

    await expect(page).toHaveURL(
      /\/projects\/DW-2\/folders\/Test\?contentQuery=migration&contentView=list/
    );
    await expect(page.getByPlaceholder('Filter diagrams…')).toHaveValue('migration');
    await expect(page.locator('button[title="List view"]')).toHaveClass(/iconBtnActive/);

    await page.goto(`/${defaultWorkspace.slug}/projects/${authMigrationProject.id}/folders/Test`);

    await expect(page).toHaveURL(/\/projects\/DW-2\/folders\/Test$/);
    await expect(page.getByText(authMigrationProject.name, { exact: true })).toBeVisible();

    await page.goto(
      `/${defaultWorkspace.slug}/projects/${authMigrationProject.id}/folders/docs/guides`
    );

    await expect(page).toHaveURL(/\/projects\/DW-2\/folders\/docs\/guides$/);
    await expect(page.getByRole('heading', { name: 'docs/guides', exact: true })).toBeVisible();
  });
});
