import { expect } from '@playwright/test';
import type { ArchRegisterScreenshotConfig } from '../../../scripts/screenshot-types.js';
import { defaultWorkspace } from '../../../../arch-register-packages/e2e/src/ui/support/workspaces';
import { apiSchema } from '../../../../arch-register-packages/e2e/src/ui/support/schemas';

export const screenshots: ArchRegisterScreenshotConfig[] = [
  {
    product: 'arch-register',
    category: 'admin',
    name: 'settings-general',
    fullPage: false,
    setup: async ({ settingsPage }) => {
      await settingsPage.goto('general');
      await settingsPage.expectLoaded();
    }
  },
  {
    product: 'arch-register',
    category: 'admin',
    name: 'schema-editor',
    fullPage: false,
    setup: async ({ dataModelPage }) => {
      await dataModelPage.goto();
      await dataModelPage.expectLoaded();
      await dataModelPage.openSchemaType(apiSchema.name);
    }
  },
  {
    product: 'arch-register',
    category: 'admin',
    name: 'model-overview',
    fullPage: false,
    setup: async ({ settingsPage }) => {
      await settingsPage.page.goto(`/${defaultWorkspace.slug}/settings/model-overview`);
      await expect(settingsPage.page.getByText('Model Overview')).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'admin',
    name: 'teams',
    fullPage: false,
    setup: async ({ settingsPage }) => {
      await settingsPage.goto('teams');
      await expect(settingsPage.page.getByRole('heading', { name: 'Teams' })).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'admin',
    name: 'members',
    fullPage: false,
    setup: async ({ settingsPage }) => {
      await settingsPage.goto('members');
      await expect(settingsPage.page.getByRole('heading', { name: 'Members' })).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'admin',
    name: 'roles',
    fullPage: false,
    setup: async ({ settingsPage }) => {
      await settingsPage.goto('roles');
      await expect(settingsPage.page.getByRole('heading', { name: 'Roles & permissions' })).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'admin',
    name: 'ai',
    fullPage: false,
    setup: async ({ settingsPage }) => {
      await settingsPage.goto('ai');
      await expect(settingsPage.page.getByRole('heading', { name: 'AI' })).toBeVisible();
    }
  },
  {
    product: 'arch-register',
    category: 'admin',
    name: 'export-import',
    fullPage: false,
    setup: async ({ settingsPage }) => {
      await settingsPage.goto('export-import');
      await expect(settingsPage.page.getByRole('heading', { name: 'Export & Import' })).toBeVisible();
    }
  }
];
