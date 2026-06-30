import type { ArchRegisterScreenshotConfig } from '../../../scripts/screenshot-types.js';
import { defaultWorkspace } from '../../../../arch-register-packages/e2e/src/ui/support/workspaces';

export const screenshots: ArchRegisterScreenshotConfig[] = [
  {
    product: 'arch-register',
    category: 'workspace',
    name: 'selector-open',
    fullPage: false,
    setup: async ({ homePage }) => {
      await homePage.goto();
      await homePage.expectLoaded(defaultWorkspace.name);
      await homePage.workspaceShell.topBar.openWorkspaceSwitcher();
    }
  },
  {
    product: 'arch-register',
    category: 'workspace',
    name: 'create-dialog',
    selector: '[role="alertdialog"]',
    setup: async ({ homePage }) => {
      await homePage.goto();
      await homePage.expectLoaded(defaultWorkspace.name);
      await homePage.workspaceShell.topBar.openAddWorkspaceFromSwitcher();
    }
  },
  {
    product: 'arch-register',
    category: 'workspace',
    name: 'home-overview',
    fullPage: false,
    setup: async ({ homePage }) => {
      await homePage.goto();
      await homePage.expectLoaded(defaultWorkspace.name);
    }
  }
];
