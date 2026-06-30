import { expect } from '@playwright/test';
import type { ArchRegisterScreenshotConfig } from '../../../scripts/screenshot-types.js';
import { defaultWorkspace } from '../../../../arch-register-packages/e2e/src/ui/support/workspaces';
import { frontendAppEntity } from '../../../../arch-register-packages/e2e/src/ui/support/entities';
import { authMigrationProject } from '../../../../arch-register-packages/e2e/src/ui/support/projects';
import {
  openProjectNewDiagramDialog,
  createBlankProjectDiagram,
  openDiagramEditorFromProject,
  createWikiPage
} from '../../../scripts/screenshot-helpers.js';

const projectDiagramName = 'Project overview draft';

export const screenshots: ArchRegisterScreenshotConfig[] = [
  {
    product: 'arch-register',
    category: 'entities',
    name: 'browser-overview',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto();
      await entitiesPage.expectLoaded();
    }
  },
  {
    product: 'arch-register',
    category: 'entities',
    name: 'browser-cards',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto({ viewMode: 'cards' });
      await entitiesPage.expectLoaded();
    }
  },
  {
    product: 'arch-register',
    category: 'entities',
    name: 'browser-tree',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto({ viewMode: 'tree' });
      await entitiesPage.expectLoaded();
    }
  },
  {
    product: 'arch-register',
    category: 'entities',
    name: 'detail-overview',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto();
      await entitiesPage.expectLoaded();
      await entitiesPage.openEntity(frontendAppEntity.name);
      await entitiesPage.expectEntityDetailLoaded(frontendAppEntity.name);
    }
  },
  {
    product: 'arch-register',
    category: 'entities',
    name: 'browser-radar',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto({ viewMode: 'radar' });
      await entitiesPage.expectLoaded();
      await expect(entitiesPage.browserTitle()).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'entities',
    name: 'create-dialog',
    selector: '[role="alertdialog"]',
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto();
      await entitiesPage.expectLoaded();
      await entitiesPage.openNewEntityDialog();
    }
  },
  {
    product: 'arch-register',
    category: 'entities',
    name: 'browser-timeline',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto({ viewMode: 'timeline' });
      await entitiesPage.expectLoaded();
      await expect(entitiesPage.browserTitle()).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'entities',
    name: 'browser-matrix',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto({ viewMode: 'matrix' });
      await entitiesPage.expectLoaded();
      await expect(entitiesPage.browserTitle()).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'entities',
    name: 'browser-explore',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto({ viewMode: 'explore' });
      await entitiesPage.expectLoaded();
      await expect(entitiesPage.browserTitle()).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'projects',
    name: 'list-overview',
    fullPage: false,
    setup: async ({ projectsPage }) => {
      await projectsPage.goto();
      await projectsPage.expectLoaded();
    }
  },
  {
    product: 'arch-register',
    category: 'projects',
    name: 'detail-home',
    fullPage: false,
    setup: async ({ projectsPage }) => {
      await projectsPage.gotoProject(authMigrationProject.id);
      await projectsPage.expectProjectOpened(authMigrationProject.name);
    }
  },
  {
    product: 'arch-register',
    category: 'projects',
    name: 'new-diagram-dialog',
    selector: '[role="alertdialog"]',
    setup: async ({ projectsPage }) => {
      await projectsPage.gotoProject(authMigrationProject.id);
      await projectsPage.expectProjectOpened(authMigrationProject.name);
      await openProjectNewDiagramDialog(projectsPage.page);
    }
  },
  {
    product: 'arch-register',
    category: 'search',
    name: 'results',
    fullPage: false,
    setup: async ({ searchPage }) => {
      await searchPage.goto();
      await searchPage.expectLoaded();
      await searchPage.search('auth');
      await searchPage.expectEntityResultsFound();
    }
  },
  {
    product: 'arch-register',
    category: 'content',
    name: 'workspace-overview',
    fullPage: false,
    setup: async ({ homePage }) => {
      await createWikiPage(homePage.page, 'workspace', 'Architecture notes');
      await homePage.page.goto(`/${defaultWorkspace.slug}/content`);
      await expect(homePage.page.getByText('Architecture notes').first()).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'content',
    name: 'project-diagram-editor',
    fullPage: false,
    setup: async ({ projectsPage }) => {
      await projectsPage.gotoProject(authMigrationProject.id);
      await createBlankProjectDiagram(projectsPage.page, projectDiagramName);
      await openDiagramEditorFromProject(projectsPage.page, projectDiagramName);
    }
  },
  {
    product: 'arch-register',
    category: 'ai',
    name: 'assistant-overview',
    fullPage: false,
    setup: async ({ homePage }) => {
      await homePage.page.goto(`/${defaultWorkspace.slug}/assistant`);
      await expect(homePage.page.getByText('Ask about your model', { exact: true })).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'ai',
    name: 'extract-overview',
    fullPage: false,
    setup: async ({ homePage }) => {
      await homePage.page.goto(`/${defaultWorkspace.slug}/extract`);
      await expect(homePage.page.getByRole('button', { name: 'Extract entities' })).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'account',
    name: 'profile',
    fullPage: false,
    setup: async ({ accountSettingsPage }) => {
      await accountSettingsPage.goto('profile');
      await accountSettingsPage.expectProfileLoaded();
    }
  }
];
