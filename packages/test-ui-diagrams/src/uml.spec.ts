import { test, expect } from '@playwright/test';
import { downloadDiagram, setTab, waitForApplicationLoaded } from './testUtils';

test('tab 1 screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/UML.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 0);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab 2 screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/UML.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 1);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab 3 screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/UML.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 2);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab 4 screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/UML.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 3);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab 5 screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/UML.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 4);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab 6 screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/UML.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 5);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab 7 screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/UML.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 6);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab 8 screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/UML.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 7);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab 9 screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/UML.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 8);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab 10 screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/UML.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 9);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab 11 screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/UML.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 10);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab 12 screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/UML.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 11);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab 13 screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/UML.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 12);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab 14 screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/UML.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 13);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab 15 screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/UML.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 14);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab 16 screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/UML.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 15);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab 17 screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/UML.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 16);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});

test('tab 18 screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/UML.json');
  await waitForApplicationLoaded(page);
  await setTab(page, 17);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});
