import { expect, test } from '@playwright/test';
import { downloadDiagram, waitForApplicationLoaded } from './testUtils';

test('sample/shapes.json', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/sample/shapes.json');
  await waitForApplicationLoaded(page);

  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('sample/arrows.json', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/sample/arrows.json');
  await waitForApplicationLoaded(page);

  expect(await downloadDiagram(page)).toMatchSnapshot();
});
