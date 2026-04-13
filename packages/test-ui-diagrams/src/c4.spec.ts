import { test, expect } from '@playwright/test';
import { downloadDiagram, setTab, waitForApplicationLoaded } from './testUtils';

test('tab 1 screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true&disable-export-fix=true#/C4.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 0);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab2.screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true&disable-export-fix=true#/C4.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 1);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab3.screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true&disable-export-fix=true#/C4.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 2);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});
