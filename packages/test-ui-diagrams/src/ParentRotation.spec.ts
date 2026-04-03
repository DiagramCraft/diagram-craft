import { test, expect } from '@playwright/test';
import { downloadDiagram, waitForApplicationLoaded } from './testUtils';

test('screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173?crdtClear=true#/ParentRotation.json');
  await waitForApplicationLoaded(page);
  expect(await downloadDiagram(page)).toMatchSnapshot();
});
