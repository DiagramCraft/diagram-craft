import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { DiagramCraftScreenshotConfig } from '../../../../scripts/screenshot-types.js';
import {
  clickDiagramCraftElement,
  loadDiagramCraftSample
} from '../../../../scripts/screenshot-helpers.js';

const openRightSidebarTab = async (page: Page, tab: 'grid') => {
  const button = page.locator('#right-sidebar button').first();
  if ((await button.getAttribute('aria-pressed')) !== 'true') {
    await button.click();
  }
  await expect(page.locator('#right-sidebar')).toBeVisible();
  await page.getByRole('tab', { name: tab === 'grid' ? 'Grid' : 'Arrange' }).click();
};

export const screenshots: DiagramCraftScreenshotConfig[] = [
  {
    product: 'diagram-craft',
    category: 'advanced-editing',
    name: 'alignment-distribution',
    clip: { x: 280, y: 80, width: 720, height: 460 },
    setup: async ({ page }) => {
      await loadDiagramCraftSample(page, 'core-diagramming.json');
      await page.keyboard.down('Shift');
      await clickDiagramCraftElement(page, '#node-browser');
      await clickDiagramCraftElement(page, '#node-service');
      await clickDiagramCraftElement(page, '#node-database');
      await page.keyboard.up('Shift');
      await page.locator('#canvas-area svg').first().click({ button: 'right', position: { x: 520, y: 240 } });
      await expect(page.getByText('Align')).toBeVisible();
      await expect(page.getByText('Distribute')).toBeVisible();
    }
  },
  {
    product: 'diagram-craft',
    category: 'advanced-editing',
    name: 'snapping-guides',
    clip: { x: 720, y: 72, width: 560, height: 650 },
    setup: async ({ page }) => {
      await loadDiagramCraftSample(page, 'core-diagramming.json');
      await openRightSidebarTab(page, 'grid');
      await expect(page.getByText('Snap to grid')).toBeVisible();
      await expect(page.getByText('Threshold')).toBeVisible();
    }
  },
  {
    product: 'diagram-craft',
    category: 'advanced-editing',
    name: 'boolean-operations',
    clip: { x: 320, y: 96, width: 640, height: 420 },
    setup: async ({ page }) => {
      await loadDiagramCraftSample(page, 'core-diagramming.json');
      await page.keyboard.down('Shift');
      await clickDiagramCraftElement(page, '#node-browser');
      await clickDiagramCraftElement(page, '#node-service');
      await page.keyboard.up('Shift');
      await page.locator('#canvas-area svg').first().click({ button: 'right', position: { x: 500, y: 220 } });
      await page.getByText('Geometry').hover();
      await expect(page.getByText('Union')).toBeVisible();
      await expect(page.getByText('Subtract')).toBeVisible();
    }
  },
  {
    product: 'diagram-craft',
    category: 'advanced-editing',
    name: 'geometry-editing',
    clip: { x: 690, y: 72, width: 590, height: 650 },
    setup: async ({ page }) => {
      await loadDiagramCraftSample(page, 'core-diagramming.json');
      const button = page.locator('#right-sidebar button').first();
      if ((await button.getAttribute('aria-pressed')) !== 'true') {
        await button.click();
      }
      await expect(page.locator('#right-sidebar')).toBeVisible();
      await clickDiagramCraftElement(page, '#node-database');
      const arrangeTab = page.getByRole('tab', { name: 'Arrange' });
      await arrangeTab.click();
      await expect(arrangeTab).toHaveAttribute('aria-selected', 'true');
    }
  }
];
