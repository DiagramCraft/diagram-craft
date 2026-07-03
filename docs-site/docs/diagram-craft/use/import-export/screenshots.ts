import type { DiagramCraftScreenshotConfig } from '../../../../scripts/screenshot-types.js';
import { loadDiagramCraftSample } from '../../../../scripts/screenshot-helpers.js';

export const screenshots: DiagramCraftScreenshotConfig[] = [
  {
    product: 'diagram-craft',
    category: 'import-export',
    name: 'drawio-imported-workflow',
    clip: { x: 40, y: 72, width: 1120, height: 620 },
    setup: async ({ page }) => {
      await loadDiagramCraftSample(page, 'docs-swimlanes.json');
      await page.locator('#canvas-area svg').first().waitFor();
    }
  }
];
