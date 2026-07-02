import { expect, type Page } from '@playwright/test';
import type { DiagramCraftScreenshotConfig } from '../../../scripts/screenshot-types.js';
import {
  clickDiagramCraftElement,
  loadDiagramCraftSample
} from '../../../scripts/screenshot-helpers.js';

const openStyleSidebar = async (page: Page) => {
  const button = page.locator('#right-sidebar button').first();
  if ((await button.getAttribute('aria-pressed')) !== 'true') {
    await button.click();
  }
  await expect(page.locator('#right-sidebar')).toBeVisible();
};

export const screenshots: DiagramCraftScreenshotConfig[] = [
  {
    product: 'diagram-craft',
    category: 'user-interface',
    name: 'editor-layout',
    fullPage: false,
    setup: async ({ page }) => {
      await loadDiagramCraftSample(page, 'core-diagramming.json');
      await openStyleSidebar(page);
      await clickDiagramCraftElement(page, '#node-service');
      await expect(page.getByText('Fill')).toBeVisible();
    }
  },
  {
    product: 'diagram-craft',
    category: 'user-interface',
    name: 'command-palette',
    clip: { x: 300, y: 130, width: 680, height: 420 },
    themes: ['light'],
    setup: async ({ page }) => {
      await loadDiagramCraftSample(page, 'core-diagramming.json');
      await page.keyboard.press('Meta+K');
      await expect(page.getByPlaceholder('Type a command...')).toBeVisible();
      await page.getByPlaceholder('Type a command...').fill('preview');
      await expect(page.getByText('Preview')).toBeVisible();
    }
  },
  {
    product: 'diagram-craft',
    category: 'user-interface',
    name: 'preview-mode',
    fullPage: false,
    themes: ['light'],
    setup: async ({ page }) => {
      await loadDiagramCraftSample(page, 'core-diagramming.json');
      await page.locator('#extra-tools button').first().click();
      await expect(page.locator('#preview')).toBeVisible();
    }
  }
];
