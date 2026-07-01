import { expect } from '@playwright/test';
import type { DiagramCraftScreenshotConfig } from '../../../../scripts/screenshot-types.js';
import {
  clickDiagramCraftElement,
  loadDiagramCraftSample
} from '../../../../scripts/screenshot-helpers.js';

export const screenshots: DiagramCraftScreenshotConfig[] = [
  {
    product: 'diagram-craft',
    category: 'layout',
    name: 'layout-workflow',
    clip: { x: 90, y: 70, width: 980, height: 600 },
    setup: async ({ page }) => {
      await loadDiagramCraftSample(page, 'docs-swimlanes.json');
      await page.keyboard.down('Shift');
      await clickDiagramCraftElement(page, '#node-h6c8qsp');
      await clickDiagramCraftElement(page, '#node-0kgm86u');
      await clickDiagramCraftElement(page, '#node-3h1czxg');
      await clickDiagramCraftElement(page, '#node-gc0jb3d');
      await clickDiagramCraftElement(page, '#node-elu74r4');
      await clickDiagramCraftElement(page, '#node-r5025sr');
      await page.keyboard.up('Shift');
      await page.locator('#canvas-area svg').first().click({ button: 'right', position: { x: 520, y: 300 } });
      await page.getByText('Layout').hover();
      await expect(page.getByText('Layered')).toBeVisible();
      await expect(page.getByText('Orthogonal')).toBeVisible();
      await expect(page.getByText('Force-Directed')).toBeVisible();
    }
  }
];
