import { expect } from '@playwright/test';
import type { DiagramCraftScreenshotConfig } from '../../../scripts/screenshot-types.js';
import { loadDiagramCraftSample } from '../../../scripts/screenshot-helpers.js';

export const screenshots: DiagramCraftScreenshotConfig[] = [
  {
    product: 'diagram-craft',
    category: 'stencils-templates',
    name: 'stencil-picker-overview',
    clip: { x: 0, y: 72, width: 430, height: 700 },
    themes: ['light'],
    setup: async ({ page }) => {
      await loadDiagramCraftSample(page, 'getting-started.json');
      await expect(page.getByRole('tab', { name: 'Shape' })).toHaveAttribute('aria-selected', 'true');
    }
  }
];
