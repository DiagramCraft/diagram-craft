import { expect, test } from '@playwright/test';
import { defaultWorkspace } from '../support/workspaces';

test.describe('assistant section', () => {
  test('restores conversations through reload and browser history', async ({ page }) => {
    await page.goto(`/${defaultWorkspace.slug}/assistant`);

    await page.getByRole('button', { name: 'New chat' }).first().click();
    await expect.poll(() => new URL(page.url()).searchParams.get('conversation')).not.toBeNull();
    const firstConversation = new URL(page.url()).searchParams.get('conversation');

    await page.getByRole('button', { name: 'New chat' }).first().click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get('conversation'))
      .not.toBe(firstConversation);
    const secondConversation = new URL(page.url()).searchParams.get('conversation');

    await page.reload();
    await expect(page.locator('[aria-current="page"]')).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`conversation=${firstConversation}`));

    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`conversation=${secondConversation}`));
  });
});
