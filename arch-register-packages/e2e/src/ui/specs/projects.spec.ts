import { test } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { authMigrationProject } from '../support/projects';
import { defaultWorkspace } from '../support/workspaces';

test.describe('projects section', () => {
  test('opens a seeded project from the workspace rail', async ({ page }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);
    const projectsPage = new ProjectsPage(page, defaultWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(defaultWorkspace.name);
    await homePage.expectProjectVisible(authMigrationProject.name);
    await projectsPage.openProject(authMigrationProject.name);
  });
});
