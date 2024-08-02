import { test, expect } from '@playwright/test';
import path from 'node:path';

test('sample/shapes.json', async ({ page }) => {
  await page.goto('http://localhost:5173#/sample/shapes.json');
  await expect(page).toHaveScreenshot({
    stylePath: path.join(__dirname, 'screenshot.css')
  });
});

test('sample/arrows.json', async ({ page }) => {
  await page.goto('http://localhost:5173#/sample/arrows.json');
  await expect(page).toHaveScreenshot({
    stylePath: path.join(__dirname, 'screenshot.css')
  });
});
