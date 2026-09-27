import { expect } from '@playwright/test';
import type { ArchRegisterScreenshotConfig } from '../../../../scripts/screenshot-types.js';
import { defaultWorkspace } from '../../../../../arch-register-packages/e2e/src/ui/support/workspaces';

const workspacePath = `/${defaultWorkspace.slug}`;

export const screenshots: ArchRegisterScreenshotConfig[] = [
  {
    product: 'arch-register',
    category: 'applications',
    name: 'strategy-capability-map',
    fullPage: false,
    setup: async ({ homePage }) => {
      await homePage.page.goto(`${workspacePath}/strategy/map`);
      await expect(homePage.page.getByRole('heading', { name: 'Capability map' })).toBeVisible();
      await expect(homePage.page.getByText('Merchandising & Assortment')).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'applications',
    name: 'vendor-contracts-calendar',
    fullPage: false,
    setup: async ({ homePage }) => {
      await homePage.page.goto(`${workspacePath}/vendor-management/contracts?view=calendar`);
      await expect(homePage.page.getByRole('heading', { name: 'Contracts' })).toBeVisible();
      await expect(homePage.page.getByText('Renewal calendar')).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'applications',
    name: 'risk-register',
    fullPage: false,
    setup: async ({ homePage }) => {
      await homePage.page.goto(`${workspacePath}/risk-compliance/risks?view=matrix&axis=residual`);
      await expect(homePage.page.getByRole('heading', { name: 'Risks' })).toBeVisible();
      await expect(homePage.page.getByText('Undetected Data Exfiltration')).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'applications',
    name: 'data-stewardship',
    fullPage: false,
    setup: async ({ homePage }) => {
      await homePage.page.goto(`${workspacePath}/data-stewardship/stewardship`);
      await expect(homePage.page.getByRole('heading', { name: 'Stewardship' })).toBeVisible();
      await expect(homePage.page.getByText('Gaps to close')).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'applications',
    name: 'api-catalog',
    fullPage: false,
    setup: async ({ homePage }) => {
      await homePage.page.goto(`${workspacePath}/api-integration-catalog/apis`);
      await expect(homePage.page.getByRole('heading', { name: 'APIs' })).toBeVisible();
      await expect(homePage.page.getByText('Customer API')).toBeVisible();
    }
  }
];
