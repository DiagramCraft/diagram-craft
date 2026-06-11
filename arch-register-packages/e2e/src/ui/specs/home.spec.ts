import { test } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { defaultWorkspace } from '../support/workspaces';

test.describe('home section', () => {
  test('shows workspace overview', async ({ page }) => {
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

  test('opens a project from the home page project list', async ({ page }) => {
    const homePage = new HomePage(page, defaultWorkspace.slug);
    const projectsPage = new ProjectsPage(page, defaultWorkspace.slug);

    await homePage.goto();
    await homePage.expectLoaded(defaultWorkspace.name);
    await homePage.expectProjectVisible('Auth Migration');
    await homePage.openProject('Auth Migration');
    await projectsPage.expectProjectOpened('Auth Migration');
  });
});
