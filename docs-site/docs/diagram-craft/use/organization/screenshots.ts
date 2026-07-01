import { expect } from '@playwright/test';
import type { DiagramCraftScreenshotConfig } from '../../../../scripts/screenshot-types.js';
import { loadDiagramCraftSample } from '../../../../scripts/screenshot-helpers.js';

const openStructurePanel = async (page: import('@playwright/test').Page) => {
  const button = page.locator('#left-sidebar button').nth(1);
  await button.click();
};

const activateNestedDiagram = async (page: import('@playwright/test').Page) => {
  await openStructurePanel(page);
  await page.locator('#left-sidebar').getByText('Document').click();
  await page.getByText('Sheet 1.1').click();
  await expect(page.getByRole('tab', { name: /Sheet 1/ })).toBeVisible();
};

export const screenshots: DiagramCraftScreenshotConfig[] = [
  {
    product: 'diagram-craft',
    category: 'organization',
    name: 'layers-workflow',
    clip: { x: 0, y: 72, width: 430, height: 660 },
    setup: async ({ page }) => {
      await loadDiagramCraftSample(page, 'docs-organization-layout-workflows.json');
      await openStructurePanel(page);
      await expect(page.locator('#left-sidebar').getByText('Adjustment').first()).toBeVisible();
      await expect(page.locator('#left-sidebar').getByText('Layer 1').first()).toBeVisible();
    }
  },
  {
    product: 'diagram-craft',
    category: 'organization',
    name: 'tabs-documents',
    clip: { x: 120, y: 0, width: 1040, height: 130 },
    setup: async ({ page }) => {
      await loadDiagramCraftSample(page, 'docs-organization-layout-workflows.json');
      await activateNestedDiagram(page);
      await expect(page.getByRole('tab', { name: /Sheet 1.*Sheet 1.1/ })).toBeVisible();
      await expect(page.getByRole('tab', { name: /Sheet 2/ })).toBeVisible();
      await expect(page.getByRole('tab', { name: /Sheet 3/ })).toBeVisible();
    }
  },
  {
    product: 'diagram-craft',
    category: 'organization',
    name: 'document-structure',
    clip: { x: 0, y: 72, width: 430, height: 660 },
    setup: async ({ page }) => {
      await loadDiagramCraftSample(page, 'docs-organization-layout-workflows.json');
      await openStructurePanel(page);
      await page.locator('#left-sidebar').getByText('Document').click();
      await expect(page.locator('#left-sidebar')).toContainText('Document');
      await expect(page.locator('#left-sidebar').getByText('Diagrams')).toBeVisible();
      await expect(page.locator('#left-sidebar').getByText('Sheet 1.1').first()).toBeVisible();
      await expect(page.locator('#left-sidebar').getByText('Sheet 3').first()).toBeVisible();
    }
  }
];
