import { test, expect } from '@playwright/test';
import { downloadDiagram, setTab, waitForApplicationLoaded } from './testUtils';

test('tab 1 screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/BPMNExamples.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 0);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab2.screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/BPMNExamples.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 1);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab3.screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/BPMNExamples.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 2);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab4.screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/BPMNExamples.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 3);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab5.screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/BPMNExamples.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 4);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab6.screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/BPMNExamples.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 5);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab7.screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/BPMNExamples.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 6);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab8.screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/BPMNExamples.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 7);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab9.screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/BPMNExamples.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 8);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab10.screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/BPMNExamples.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 9);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});
