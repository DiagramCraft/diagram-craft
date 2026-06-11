import { test } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { loginAsSeededUser } from '../support/auth';
import { defaultWorkspace } from '../support/workspaces';

test.describe('projects section', () => {
  test('opens a seeded project from the workspace rail', async ({ page }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);
    const projectsPage = new ProjectsPage(page, defaultWorkspace.slug);

    await loginAsSeededUser(page);
    await homePage.goto();
    await projectsPage.openProject('Auth Migration');
  });
});
