import { expect } from '@playwright/test';
import type { DiagramCraftScreenshotConfig } from '../../../scripts/screenshot-types.js';
import {
  loadDiagramCraftSample,
  selectDiagramCraftTool,
  clickDiagramCraftElement
} from '../../../scripts/screenshot-helpers.js';
import { setTimeout as sleep } from 'node:timers/promises';

export const screenshots: DiagramCraftScreenshotConfig[] = [
  {
    product: 'diagram-craft',
    category: 'core-diagramming',
    name: 'canvas-navigation',
    fullPage: false,
    setup: async ({ page }) => {
      await loadDiagramCraftSample(page, 'core-diagramming.json');
    }
  },
  {
    product: 'diagram-craft',
    category: 'core-diagramming',
    name: 'shapes-elements',
    clip: { x: 0, y: 72, width: 1040, height: 520 },
    setup: async ({ page }) => {
      await loadDiagramCraftSample(page, 'core-diagramming.json');
      await expect(page.getByRole('tab', { name: 'Shape' })).toHaveAttribute('aria-selected', 'true');
    }
  },
  {
    product: 'diagram-craft',
    category: 'core-diagramming',
    name: 'connectors-edges',
    clip: { x: 360, y: 120, width: 520, height: 420 },
    setup: async ({ page }) => {
      await loadDiagramCraftSample(page, 'core-diagramming.json');
      await selectDiagramCraftTool(page, 'TOOL_MOVE');
      await clickDiagramCraftElement(page, '#edge-service-to-database .svg-edge');
      await expect(page.locator('.svg-waypoint-handle')).toBeVisible();
    }
  },
  {
    product: 'diagram-craft',
    category: 'core-diagramming',
    name: 'text-labels',
    clip: { x: 320, y: 96, width: 760, height: 420 },
    setup: async ({ page }) => {
      await loadDiagramCraftSample(page, 'core-diagramming.json');
      await clickDiagramCraftElement(page, '#node-note-text', { clickCount: 2 });
      await sleep(200);
    }
  },
  {
    product: 'diagram-craft',
    category: 'core-diagramming',
    name: 'selection-manipulation',
    clip: { x: 360, y: 120, width: 520, height: 420 },
    setup: async ({ page }) => {
      await loadDiagramCraftSample(page, 'core-diagramming.json');
      await clickDiagramCraftElement(page, '#node-service');
      await expect(page.locator('.svg-selection__handle')).toHaveCount(8);
    }
  }
];
