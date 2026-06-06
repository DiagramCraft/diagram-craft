import { test, expect } from './fixtures';

test('shows default workspace after login', async ({ loggedInPage }) => {
  await expect(loggedInPage.getByRole('main').getByText('Default Workspace', { exact: true })).toBeVisible();
});

test('navigates to entity list', async ({ loggedInPage }) => {
  await loggedInPage.goto('/default/entities');
  await expect(loggedInPage.getByRole('main')).toBeVisible();
});
