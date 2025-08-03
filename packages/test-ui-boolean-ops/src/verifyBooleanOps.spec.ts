import { expect, Page, test } from '@playwright/test';

const storybookScreenshotCheck = async (page: Page, groupId: string, testId: string) => {
  await page.goto(
    `/iframe.html?globals=&args=hideText%3A!true&id=geometry-path-${groupId}--${testId}&viewMode=story`
  );
  await page.waitForSelector('svg');
  expect(await page.screenshot()).toMatchSnapshot();
};

test.describe('Boolean', () => {
  test('Primary', async ({ page }) => {
    await storybookScreenshotCheck(page, 'boolean', 'primary');
  });

  test('On Edge', async ({ page }) => {
    await storybookScreenshotCheck(page, 'boolean', 'on-edge');
  });

  test('On Edge 2', async ({ page }) => {
    await storybookScreenshotCheck(page, 'boolean', 'on-edge-2');
  });

  test('Non Intersecting', async ({ page }) => {
    await storybookScreenshotCheck(page, 'boolean', 'non-intersecting');
  });

  test('Circle In Rectangle Inverted', async ({ page }) => {
    await storybookScreenshotCheck(page, 'boolean', 'circle-in-rectangle-inverted');
  });
  test('Right Triangle Over Rectangle', async ({ page }) => {
    await storybookScreenshotCheck(page, 'boolean', 'right-triangle-over-rectangle');
  });
});

test.describe('VectorBoolean', () => {
  test('Circle Overlapping Rectangle', async ({ page }) => {
    await storybookScreenshotCheck(page, 'vectorboolean', 'circle-overlapping-rectangle');
  });

  test('Circle In Rectangle', async ({ page }) => {
    await storybookScreenshotCheck(page, 'vectorboolean', 'circle-in-rectangle');
  });

  test('Rectangle In Circle', async ({ page }) => {
    await storybookScreenshotCheck(page, 'vectorboolean', 'rectangle-in-circle');
  });

  test('Circle On Rectangle', async ({ page }) => {
    await storybookScreenshotCheck(page, 'vectorboolean', 'circle-on-rectangle');
  });

  test('Rect Over Rect With Hole', async ({ page }) => {
    await storybookScreenshotCheck(page, 'vectorboolean', 'rect-over-rect-with-hole');
  });

  test('Circle Over Two Rects', async ({ page }) => {
    await storybookScreenshotCheck(page, 'vectorboolean', 'circle-over-two-rects');
  });

  test('Circle Over Circle', async ({ page }) => {
    await storybookScreenshotCheck(page, 'vectorboolean', 'circle-over-circle');
  });

  test('Complex Shapes', async ({ page }) => {
    await storybookScreenshotCheck(page, 'vectorboolean', 'complex-shapes');
  });

  test('Complex Shapes 2', async ({ page }) => {
    await storybookScreenshotCheck(page, 'vectorboolean', 'complex-shapes-2');
  });

  test('Triangle Inside Rectangle', async ({ page }) => {
    await storybookScreenshotCheck(page, 'vectorboolean', 'triangle-inside-rectangle');
  });

  test('Diamond Overlapping Rectangle', async ({ page }) => {
    await storybookScreenshotCheck(page, 'vectorboolean', 'diamond-overlapping-rectangle');
  });

  test('Diamond Inside Rectangle', async ({ page }) => {
    await storybookScreenshotCheck(page, 'vectorboolean', 'diamond-inside-rectangle');
  });
});
