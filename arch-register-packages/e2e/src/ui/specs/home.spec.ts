import { test } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { authMigrationProject } from '../support/projects';
import { defaultWorkspace } from '../support/workspaces';

test.describe('home section', () => {
  test('shows workspace overview @quick', async ({ page }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(defaultWorkspace.name);
  });

  test('opens the new project dialog', async ({ page }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(defaultWorkspace.name);
    await homePage.openNewProjectDialog();
  });

  test('opens the new entity dialog', async ({ page }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(defaultWorkspace.name);
    await homePage.openNewEntityDialog();
  });

  test('opens a project from the home page project list @quick', async ({ page }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);
    const projectsPage = new ProjectsPage(page, defaultWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(defaultWorkspace.name);
    await homePage.expectProjectVisible(authMigrationProject.name);
    await homePage.openProject(authMigrationProject.name);
    await projectsPage.expectProjectOpened(authMigrationProject.name);
  });
});
