import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { DiagramCraftScreenshotConfig } from '../../../../scripts/screenshot-types.js';
import {
  clickDiagramCraftElement,
  loadDiagramCraftSample
} from '../../../../scripts/screenshot-helpers.js';

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
    category: 'styling',
    name: 'style-controls',
    clip: { x: 710, y: 72, width: 570, height: 650 },
    setup: async ({ page }) => {
      await loadDiagramCraftSample(page, 'core-diagramming.json');
      await openStyleSidebar(page);
      await clickDiagramCraftElement(page, '#node-service');
      await expect(page.getByText('Fill')).toBeVisible();
    }
  },
  {
    product: 'diagram-craft',
    category: 'styling',
    name: 'effects-controls',
    clip: { x: 710, y: 72, width: 570, height: 650 },
    setup: async ({ page }) => {
      await loadDiagramCraftSample(page, 'core-diagramming.json');
      await openStyleSidebar(page);
      await clickDiagramCraftElement(page, '#node-service');
      await page.getByText('Effects').scrollIntoViewIfNeeded();
      await expect(page.getByText('Effects')).toBeVisible();
    }
  }
];
