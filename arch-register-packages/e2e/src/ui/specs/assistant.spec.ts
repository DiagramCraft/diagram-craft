import { expect } from '@playwright/test';
import { test } from '../fixtures';
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

  test('renders an AG-UI SSE response from the upgraded chat client', async ({ page }) => {
    let requestBody: Record<string, unknown> | undefined;

    await page.route('**/api/application/v1/default/ai/chat', async route => {
      requestBody = route.request().postDataJSON() as Record<string, unknown>;
      const threadId = String(requestBody['threadId']);
      const runId = String(requestBody['runId']);
      const messageId = 'mock-assistant-message';
      const events = [
        { type: 'RUN_STARTED', threadId, runId },
        { type: 'TEXT_MESSAGE_START', messageId, role: 'assistant' },
        { type: 'TEXT_MESSAGE_CONTENT', messageId, delta: 'Mock UI reply' },
        { type: 'TEXT_MESSAGE_END', messageId },
        { type: 'RUN_FINISHED', threadId, runId, outcome: { type: 'success' } }
      ];

      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('')
      });
    });

    await page.goto(`/${defaultWorkspace.slug}/assistant`);
    await page.getByRole('button', { name: 'New chat' }).first().click();
    await expect.poll(() => new URL(page.url()).searchParams.get('conversation')).not.toBeNull();
    const conversationId = new URL(page.url()).searchParams.get('conversation');

    await page.getByPlaceholder('Ask a question, or describe a change...').fill('Say hello');
    await page.getByTitle('Send (Enter)').click();

    await expect(page.getByText('Mock UI reply', { exact: true })).toBeVisible();
    expect(requestBody).toMatchObject({
      threadId: conversationId,
      forwardedProps: { conversationId },
      data: { conversationId },
      messages: [{ role: 'user', content: 'Say hello' }]
    });
  });
});
