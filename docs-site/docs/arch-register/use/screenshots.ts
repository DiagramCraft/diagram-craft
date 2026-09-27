import { expect } from '@playwright/test';
import type { ArchRegisterScreenshotConfig } from '../../../scripts/screenshot-types.js';
import { defaultWorkspace } from '../../../../arch-register-packages/e2e/src/ui/support/workspaces';
import {
  authApiEntity,
  customerApiEntity,
  frontendAppEntity
} from '../../../../arch-register-packages/e2e/src/ui/support/entities';
import {
  authMigrationProject,
  checkoutRevampProject
} from '../../../../arch-register-packages/e2e/src/ui/support/projects';
import { seededAssessments } from '../../../../arch-register-packages/server/src/db/seedFixtures';
import { domainSchema, systemSchema, componentSchema } from '../../../../arch-register-packages/e2e/src/ui/support/schemas';
import {
  openProjectNewDiagramDialog,
  createBlankProjectDiagram,
  openDiagramEditorFromProject,
  createWikiPage
} from '../../../scripts/screenshot-helpers.js';

const projectDiagramName = 'Project overview draft';
let seededApiCatalogScreenshotSource: { artifactId: string; revisionId: string } | undefined;

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
    name: 'browser-graph',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto({ viewMode: 'graph', type: componentSchema.id, q: 'Frontend App' });
      await expect(entitiesPage.browserTitle()).toHaveText(componentSchema.name);
      await expect(entitiesPage.graphNodes().first()).toBeVisible({ timeout: 15000 });
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
    name: 'detail-topology',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto();
      await entitiesPage.expectLoaded();
      await entitiesPage.openEntity(frontendAppEntity.name);
      const topologyUrl = new URL(entitiesPage.page.url());
      topologyUrl.searchParams.set('tab', 'topology');
      await entitiesPage.page.goto(topologyUrl.toString());
      const topologyTab = entitiesPage.page.getByRole('tab', { name: 'Topology', exact: true });
      await expect(topologyTab).toBeVisible();
      await expect(topologyTab).toHaveAttribute('aria-selected', 'true');
    }
  },
  {
    product: 'arch-register',
    category: 'entities',
    name: 'baseline-detail',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto();
      const baseline = await entitiesPage.createWorkspaceBaseline('Architecture baseline');
      await entitiesPage.goto();
      await entitiesPage.baselinesTab().click();
      await entitiesPage.page.getByTestId(`workspace-baseline-${baseline.id}`).click();
      await expect(entitiesPage.page.getByRole('heading', { name: baseline.name })).toBeVisible();
      await expect(entitiesPage.page.getByRole('tab', { name: 'Compare' })).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'entities',
    name: 'api-catalog',
    fullPage: false,
    selector: '[aria-label="Normalized API catalog"]',
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto();
      if (seededApiCatalogScreenshotSource == null) {
        seededApiCatalogScreenshotSource = await entitiesPage.seedApiSpecification(
          authApiEntity.id,
          {
            openapi: '3.1.0',
            info: { title: 'Auth API', version: 'v1' },
            paths: {
              '/sessions': {
                get: {
                  operationId: 'listSessions',
                  summary: 'List sessions',
                  responses: { '200': { description: 'ok' } }
                }
              }
            }
          },
          'docs-example-v1'
        );
      }
      await entitiesPage.openApiCatalog(authApiEntity.name);
      const catalog = entitiesPage.page.locator('[aria-label="Normalized API catalog"]');
      await expect(catalog).toBeVisible();
      await catalog.scrollIntoViewIfNeeded();
    }
  },
  {
    product: 'arch-register',
    category: 'entities',
    name: 'merge-review',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto();
      await entitiesPage.openEntity(authApiEntity.name);
      await entitiesPage.openEntityActions();
      await entitiesPage.page.getByRole('menuitem', { name: 'Merge into…' }).click();
      const mergeDialog = entitiesPage.page.getByRole('alertdialog', { name: 'Merge entity' });
      await mergeDialog.getByPlaceholder('Search for an entity…').fill(customerApiEntity.name);
      await entitiesPage.page.getByRole('option', { name: customerApiEntity.name }).click();
      await mergeDialog.getByRole('button', { name: 'Next' }).click();
      await expect(mergeDialog.getByText(/entity versions transferring/)).toBeVisible();
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
    name: 'browser-diff',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto({ viewMode: 'diff', asOf: '2026-12-31' });
      await expect(entitiesPage.browserTitle()).toBeVisible();
      await expect(entitiesPage.page.getByText(/What changes by/)).toBeVisible({ timeout: 15000 });
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
    name: 'browser-bubble',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto({ viewMode: 'bubble' });
      await entitiesPage.expectLoaded();
      await expect(entitiesPage.browserTitle()).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'entities',
    name: 'browser-map',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      // TanStack Router's default search codec JSON-parses every string query value on load, so a
      // once-stringified `viewConfigs` value would decode straight into an object and get rejected
      // by useEntityBrowserSearchState's `typeof === 'string'` guard. Stringifying twice mirrors
      // what the app's own navigate() call produces, so it survives that round-trip as a string.
      const viewConfigs = JSON.stringify(
        JSON.stringify({
          map: {
            levels: 2,
            level1SchemaId: domainSchema.id,
            level1Columns: 3,
            level2SchemaId: systemSchema.id,
            level2Columns: 3,
            metricConfig: {
              sourceSchemaId: componentSchema.id,
              source: { kind: 'lifecycle' },
              aggregation: 'count'
            }
          }
        })
      );
      await entitiesPage.goto({ viewMode: 'map', viewConfigs });
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
    category: 'entities',
    name: 'browser-traceability',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto({ viewMode: 'traceability' });
      await entitiesPage.expectLoaded();
      await expect(entitiesPage.page.getByRole('button', { name: 'Add path' })).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'entities',
    name: 'browser-path-walker',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      await entitiesPage.goto({ viewMode: 'path-walker', type: componentSchema.id });
      await expect(entitiesPage.browserTitle()).toBeVisible();
      await entitiesPage.page.getByRole('button', { name: /Frontend App/ }).click();
      await expect(
        entitiesPage.page.getByRole('combobox', { name: 'Relation to follow from column 1' })
      ).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'entities',
    name: 'browser-heatmap',
    fullPage: false,
    setup: async ({ entitiesPage }) => {
      const viewConfigs = JSON.stringify(
        JSON.stringify({
          heatmap: {
            likelihoodFieldId: '_lifecycle',
            impactFieldId: '_owner',
            buckets: 5,
            colorFieldId: null
          }
        })
      );
      await entitiesPage.goto({ viewMode: 'heatmap', type: componentSchema.id, viewConfigs });
      await expect(entitiesPage.browserTitle()).toHaveText(componentSchema.name);
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
    name: 'milestones',
    fullPage: false,
    setup: async ({ projectsPage }) => {
      await projectsPage.page.goto(
        `/${defaultWorkspace.slug}/projects/${authMigrationProject.id}?tab=projects&section=milestones`
      );
      await expect(projectsPage.page.getByRole('heading', { name: 'Milestones' })).toBeVisible();
      await expect(projectsPage.page.getByText('Identity platform cutover')).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'projects',
    name: 'planned-changes-timeline',
    fullPage: false,
    setup: async ({ projectsPage }) => {
      await projectsPage.page.goto(
        `/${defaultWorkspace.slug}/projects/${authMigrationProject.id}?tab=projects&section=entities`
      );
      await expect(projectsPage.page.getByRole('heading', { name: 'Project Entities' })).toBeVisible();
      await projectsPage.page.getByRole('button', { name: 'Timeline', exact: true }).click();
      await expect(projectsPage.page.getByRole('toolbar', { name: 'Timeline grouping' })).toBeVisible();
      await expect(projectsPage.page.getByText('Planned change', { exact: true })).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'projects',
    name: 'planned-changes-summary',
    fullPage: false,
    setup: async ({ projectsPage }) => {
      await projectsPage.page.goto(
        `/${defaultWorkspace.slug}/projects/${authMigrationProject.id}?tab=projects&section=entities`
      );
      await expect(projectsPage.page.getByRole('heading', { name: 'Project Entities' })).toBeVisible();
      await projectsPage.page.getByRole('button', { name: "What's changed", exact: true }).click();
      await expect(projectsPage.page.getByText(/What's changed by/)).toBeVisible();
      await expect(projectsPage.page.getByText('Overdue changes')).toBeVisible();
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
    category: 'projects',
    name: 'assessments-list',
    fullPage: false,
    setup: async ({ projectsPage }) => {
      await projectsPage.page.goto(
        `/${defaultWorkspace.slug}/projects/${checkoutRevampProject.id}?tab=projects&section=assessments`
      );
      await expect(projectsPage.page.getByRole('heading', { name: 'Assessments' })).toBeVisible();
      await expect(
        projectsPage.page.getByText(seededAssessments.checkoutRevamp.securityReadiness.name)
      ).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'projects',
    name: 'assessment-editor',
    selector: '[role="alertdialog"]',
    setup: async ({ projectsPage }) => {
      await projectsPage.page.goto(
        `/${defaultWorkspace.slug}/projects/${checkoutRevampProject.id}?tab=projects&section=assessments&assessmentId=${seededAssessments.checkoutRevamp.securityReadiness.id}`
      );
      await expect(
        projectsPage.page.getByRole('heading', {
          name: seededAssessments.checkoutRevamp.securityReadiness.name
        })
      ).toBeVisible();
      await projectsPage.page.getByRole('button', { name: 'Edit' }).click();
      await expect(projectsPage.page.getByRole('alertdialog', { name: 'Edit assessment' })).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'projects',
    name: 'assessment-assignment',
    selector: '[role="alertdialog"]',
    setup: async ({ projectsPage }) => {
      await projectsPage.page.goto(
        `/${defaultWorkspace.slug}/projects/${checkoutRevampProject.id}?tab=projects&section=assessments`
      );
      await expect(projectsPage.page.getByRole('heading', { name: 'Assessments' })).toBeVisible();
      await projectsPage.page.getByRole('button', { name: 'New assessment' }).first().click();
      await expect(projectsPage.page.getByRole('alertdialog', { name: 'New assessment' })).toBeVisible();
      await projectsPage.page.getByRole('tab', { name: 'Assignment' }).click();
      const teamPicker = projectsPage.page.getByRole('combobox', {
        name: 'Search teams to add…'
      });
      await teamPicker.fill('Security');
      await projectsPage.page.getByRole('option', { name: 'Security & Compliance' }).click();
      await projectsPage.page.locator('input[type="date"]').fill('2026-10-31');
      await expect(projectsPage.page.locator('button[title="Remove team"]')).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'projects',
    name: 'assessment-recurrence',
    selector: '[role="alertdialog"]',
    setup: async ({ projectsPage }) => {
      await projectsPage.page.goto(
        `/${defaultWorkspace.slug}/projects/${checkoutRevampProject.id}?tab=projects&section=assessments`
      );
      await expect(projectsPage.page.getByRole('heading', { name: 'Assessments' })).toBeVisible();
      await projectsPage.page.getByRole('button', { name: 'New assessment' }).first().click();
      await expect(projectsPage.page.getByRole('alertdialog', { name: 'New assessment' })).toBeVisible();
      await projectsPage.page.getByRole('tab', { name: 'Advanced' }).click();
      await projectsPage.page.getByRole('combobox').last().click();
      await projectsPage.page.getByRole('option', { name: 'Monthly' }).click();
      await projectsPage.page.getByRole('textbox', { name: 'Every N months' }).fill('3');
      await projectsPage.page.getByRole('textbox', { name: 'Response window (days)' }).fill('14');
      await expect(projectsPage.page.getByText('Response window (days)')).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'projects',
    name: 'assessment-details',
    fullPage: false,
    setup: async ({ projectsPage }) => {
      await projectsPage.page.goto(
        `/${defaultWorkspace.slug}/projects/${checkoutRevampProject.id}?tab=projects&section=assessments&assessmentId=${seededAssessments.checkoutRevamp.securityReadiness.id}`
      );
      await expect(
        projectsPage.page.getByRole('heading', {
          name: seededAssessments.checkoutRevamp.securityReadiness.name
        })
      ).toBeVisible();
      await expect(projectsPage.page.getByRole('tab', { name: 'Details' })).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'projects',
    name: 'assessment-summary',
    fullPage: false,
    setup: async ({ projectsPage }) => {
      await projectsPage.page.goto(
        `/${defaultWorkspace.slug}/projects/${checkoutRevampProject.id}?tab=projects&section=assessments&assessmentId=${seededAssessments.checkoutRevamp.securityReadiness.id}`
      );
      await expect(
        projectsPage.page.getByRole('heading', {
          name: seededAssessments.checkoutRevamp.securityReadiness.name
        })
      ).toBeVisible();
      await projectsPage.page.getByRole('tab', { name: 'Summary' }).click();
      await expect(projectsPage.page.getByText('Entities assessed')).toBeVisible();
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
