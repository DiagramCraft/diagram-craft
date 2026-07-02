import { expect } from '@playwright/test';
import type { DiagramCraftScreenshotConfig } from '../../../../scripts/screenshot-types.js';
import { loadDiagramCraftSample } from '../../../../scripts/screenshot-helpers.js';

const openTextPanel = async (page: import('@playwright/test').Page) => {
  await page.locator('#left-sidebar button').nth(5).click();
};

export const screenshots: DiagramCraftScreenshotConfig[] = [
  {
    product: 'diagram-craft',
    category: 'ai-features',
    name: 'text-workflow',
    clip: { x: 0, y: 72, width: 560, height: 660 },
    setup: async ({ page }) => {
      await loadDiagramCraftSample(page, 'getting-started.json');
      await openTextPanel(page);
      await expect(page.locator('#left-sidebar')).toContainText('Text');
      await expect(page.locator('#left-sidebar')).toContainText(':');
    }
  }
];
