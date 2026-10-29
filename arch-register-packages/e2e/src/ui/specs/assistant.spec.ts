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

  test('renders a v1 stream and restores the persisted transcript after reload', async ({ page }) => {
    let requestBody: Record<string, unknown> | undefined;
    let transcriptAvailable = false;

    await page.route('**/ai/conversations/*/messages', async route => {
      if (!transcriptAvailable) {
        await route.fulfill({ json: [] });
        return;
      }

      const path = new URL(route.request().url()).pathname.split('/');
      const conversationId = path.at(-2);
      await route.fulfill({
        json: [
          {
            id: 'saved-user-message',
            conversation_id: conversationId,
            role: 'user',
            content: 'Say hello',
            metadata: {},
            created_at: '2026-10-29T10:00:00.000Z'
          },
          {
            id: 'saved-assistant-message',
            conversation_id: conversationId,
            role: 'assistant',
            content: 'Mock UI reply',
            metadata: {},
            created_at: '2026-10-29T10:00:01.000Z'
          }
        ]
      });
    });

    await page.route('**/api/application/v1/default/ai/chat', async route => {
      requestBody = route.request().postDataJSON() as Record<string, unknown>;
      transcriptAvailable = true;
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
      forwardedProps: { conversationId }
    });
    expect(requestBody).not.toHaveProperty('data');
    expect(JSON.stringify(requestBody?.['messages'])).toContain('Say hello');

    await page.reload();
    await expect(page.getByText('Say hello', { exact: true })).toBeVisible();
    await expect(page.getByText('Mock UI reply', { exact: true })).toBeVisible();
  });

  test('shows and responds to a streamed tool approval', async ({ page }) => {
    const requestBodies: Array<Record<string, unknown>> = [];

    await page.route('**/api/application/v1/default/ai/chat', async route => {
      const requestBody = route.request().postDataJSON() as Record<string, unknown>;
      requestBodies.push(requestBody);
      const threadId = String(requestBody['threadId']);
      const runId = String(requestBody['runId']);
      const messageId = `mock-assistant-message-${requestBodies.length}`;
      const events =
        requestBodies.length === 1
          ? [
              { type: 'RUN_STARTED', threadId, runId },
              {
                type: 'TOOL_CALL_START',
                messageId,
                toolCallId: 'approval-call-1',
                toolCallName: 'create_entity'
              },
              {
                type: 'TOOL_CALL_ARGS',
                toolCallId: 'approval-call-1',
                delta: '{"schemaId":"schema-1","name":"Review Service"}'
              },
              {
                type: 'TOOL_CALL_END',
                toolCallId: 'approval-call-1',
                input: { schemaId: 'schema-1', name: 'Review Service' }
              },
              {
                type: 'MESSAGES_SNAPSHOT',
                messages: [
                  { id: 'user-message', role: 'user', content: 'Create a service' },
                  {
                    id: messageId,
                    role: 'assistant',
                    toolCalls: [
                      {
                        id: 'approval-call-1',
                        type: 'function',
                        function: {
                          name: 'create_entity',
                          arguments: '{"schemaId":"schema-1","name":"Review Service"}'
                        }
                      }
                    ]
                  }
                ]
              },
              {
                type: 'RUN_FINISHED',
                threadId,
                runId,
                outcome: {
                  type: 'interrupt',
                  interrupts: [
                    {
                      id: 'approval_approval-call-1',
                      reason: 'tool_call',
                      message: 'Approval required to run create_entity',
                      toolCallId: 'approval-call-1',
                      responseSchema: {
                        oneOf: [
                          {
                            type: 'object',
                            properties: {
                              approved: { const: true },
                              editedArgs: {
                                type: 'object',
                                properties: {
                                  schemaId: { type: 'string' },
                                  name: { type: 'string' },
                                  slug: { type: 'string' },
                                  namespace: { type: 'string' },
                                  description: { type: 'string' },
                                  owner: { type: ['string', 'null'] },
                                  lifecycle: { type: ['string', 'null'] },
                                  tags: { type: 'array', items: { type: 'string' } },
                                  fields: { type: 'object', additionalProperties: true }
                                },
                                required: ['schemaId'],
                                additionalProperties: false
                              }
                            },
                            required: ['approved'],
                            additionalProperties: false
                          },
                          {
                            type: 'object',
                            properties: { approved: { const: false } },
                            required: ['approved'],
                            additionalProperties: false
                          }
                        ]
                      },
                      metadata: {
                        kind: 'approval',
                        toolName: 'create_entity',
                        input: { schemaId: 'schema-1', name: 'Review Service' },
                        'tanstack:interruptBinding': {
                          v: 1,
                          kind: 'tool-approval',
                          interruptId: 'approval_approval-call-1',
                          toolName: 'create_entity',
                          toolCallId: 'approval-call-1',
                          originalArgs: { schemaId: 'schema-1', name: 'Review Service' },
                          inputSchemaHash:
                            'sha256:a8ffcd8cd04fa5b99e1ee5554e36dc417780fc64cbbcee8292c2fe51e74a4e11',
                          approvalSchemaHash:
                            'sha256:22f76d9a1c618a3cfaa891208a14f6e5e6ab1be4ff1c38cc8a8cd1e8fd0c0e4e',
                          responseSchemaHash:
                            'sha256:f59c82b0a786943eac6d3a6a5d50701b4114b4f7e76ad5551ae9c61282e98724',
                          interruptedRunId: runId,
                          generation: 0
                        }
                      }
                    }
                  ]
                }
              }
            ]
          : [
              {
                type: 'RUN_STARTED',
                threadId,
                runId,
                ...(typeof requestBody['parentRunId'] === 'string'
                  ? { parentRunId: requestBody['parentRunId'] }
                  : {})
              },
              { type: 'TEXT_MESSAGE_START', messageId, role: 'assistant' },
              { type: 'TEXT_MESSAGE_CONTENT', messageId, delta: 'Entity created.' },
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
    await page.getByPlaceholder('Ask a question, or describe a change...').fill('Create a service');
    await page.getByTitle('Send (Enter)').click();

    await expect(page.getByText('Create entity', { exact: true })).toBeVisible();
    await expect(page.getByText('Review Service', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Approve' }).click();

    await expect(page.getByText('Approved', { exact: true })).toBeVisible();
    await expect(page.getByText('Entity created.', { exact: true })).toBeVisible();
    await expect.poll(() => requestBodies.length).toBe(2);
    expect(requestBodies[1]).toMatchObject({
      threadId: requestBodies[0]?.['threadId'],
      parentRunId: requestBodies[0]?.['runId'],
      forwardedProps: { conversationId: requestBodies[0]?.['threadId'] },
      resume: [
        {
          interruptId: 'approval_approval-call-1',
          status: 'resolved',
          payload: { approved: true }
        }
      ]
    });
    expect(requestBodies[1]).not.toHaveProperty('data');
  });
});
