import { test as baseTest, expect } from 'vitest';
import { startTestServer, type TestServer } from '../helpers/serverHelper';
import { makeAuthHeader, seedMinimal } from '../helpers/seedHelper';

type SeededFixtures = {
  conversationId: string;
  otherConversationId: string;
  otherUserId: string;
};

const mockAiChatOverrides = {
  chatParamsFromRequestBodyImpl: async (body: unknown) => {
    const data = body as Record<string, unknown>;
    return {
      messages:
        ((data['messages'] as Array<{ role: string; content?: unknown; parts?: Array<{ type?: string; content?: string }> }>) ??
          []),
      threadId: String(data['threadId'] ?? 'thread-1'),
      runId: String(data['runId'] ?? 'run-1'),
      parentRunId: undefined,
      tools: [],
      forwardedProps: (data['forwardedProps'] as Record<string, unknown>) ?? {},
      state: data['state'] ?? null,
      context: []
    };
  },
  buildSystemPromptImpl: async () => 'Mock system prompt',
  createAiTextAdapterImpl: () => ({ provider: 'mock' }) as never,
  createAiChatToolsImpl: () => [],
  chatImpl: ((options: Record<string, unknown>) => {
    if (options['stream'] === false) {
      return Promise.resolve(
        '[{"name":"Billing API","schema_id":"schema-api","fields":{"system":"Customer Portal"}}]'
      );
    }

    return (async function* () {
      yield { type: 'TEXT_MESSAGE_CONTENT', delta: 'Mock assistant ' };
      yield { type: 'TEXT_MESSAGE_CONTENT', delta: 'reply' };
    })();
  }) as never,
  toServerSentEventsResponseImpl: (stream: AsyncIterable<Record<string, unknown>>) =>
    new Response(
      new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          for await (const chunk of stream) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }
          controller.close();
        }
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream'
        }
      }
    ),
  randomId: (() => {
    let i = 0;
    return () => `mock-ai-id-${++i}`;
  })()
} as const;

const test = baseTest.extend<{
  server: TestServer;
  auth: string;
  seeded: SeededFixtures;
}>({
  server: [
    async ({}, use) => {
      const server = await startTestServer({
        appOptions: {
          routeOverrides: {
            aiChat: mockAiChatOverrides as never
          }
        }
      });
      await seedMinimal(server.db);
      await use(server);
      await server.stop();
    },
    { scope: 'file' }
  ],
  auth: [
    async ({ server }, use) => {
      await use(await makeAuthHeader(server.db));
    },
    { scope: 'file' }
  ],
  seeded: [
    async ({ server }, use) => {
      const now = new Date('2026-06-07T12:00:00.000Z');

      await server.db.ai.upsertAiConfig('default', {
        provider: 'openai',
        api_key_enc: 'mock-api-key',
        model: 'gpt-test',
        temperature: 0.4,
        system_prompt: 'Be concise',
        enabled: true
      });

      await server.db.workspaceAdmin.createWorkspace({
        id: 'no-ai',
        name: 'No AI Workspace',
        url_slug: 'no-ai',
        short_code: 'NA',
        color: '',
        description: '',
        created_at: now,
        updated_at: now
      });

      await server.db.identityAuth.createUser({
        id: 'other-ai-user',
        email: 'other-ai-user@e2e.test',
        display_name: 'Other AI User',
        auth_provider: 'local',
        password_hash: null,
        oidc_issuer: null,
        oidc_subject: null,
        is_active: true,
        color: null,
        created_at: now,
        updated_at: now,
        last_login_at: null
      });

      const ownConversation = await server.db.ai.createConversation({
        id: 'ai-conv-1',
        workspace: 'default',
        user_id: 'test-admin',
        title: 'New conversation',
        created_at: now,
        updated_at: now
      });

      await server.db.ai.createMessage({
        id: 'ai-msg-1',
        conversation_id: ownConversation.id,
        role: 'assistant',
        content: 'Existing assistant message',
        metadata: {},
        created_at: now
      });

      await server.db.ai.createConversation({
        id: 'ai-conv-other',
        workspace: 'default',
        user_id: 'other-ai-user',
        title: 'Other user conversation',
        created_at: now,
        updated_at: now
      });

      await use({
        conversationId: ownConversation.id,
        otherConversationId: 'ai-conv-other',
        otherUserId: 'other-ai-user'
      });
    },
    { scope: 'file' }
  ]
});

const headers = (auth: string) => ({
  Authorization: auth,
  'Content-Type': 'application/json'
});

test.describe('ai chat routes', () => {
  test('GET /api/:workspace/ai/conversations lists only the current user conversations', async ({
    server,
    auth,
    seeded
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/ai/conversations`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body).toEqual([
      expect.objectContaining({
        id: seeded.conversationId,
        title: 'New conversation'
      })
    ]);
  });

  test('POST /api/:workspace/ai/conversations creates a conversation with default and explicit titles', async ({
    server,
    auth,
    seeded: _
  }) => {
    const defaultRes = await fetch(`${server.baseUrl}/api/default/ai/conversations`, {
      method: 'POST',
      headers: headers(auth),
      body: JSON.stringify({})
    });
    expect(defaultRes.status).toBe(200);
    await expect(defaultRes.json()).resolves.toMatchObject({
      title: 'New conversation',
      user_id: 'test-admin'
    });

    const customRes = await fetch(`${server.baseUrl}/api/default/ai/conversations`, {
      method: 'POST',
      headers: headers(auth),
      body: JSON.stringify({ title: 'Architecture Q&A' })
    });
    expect(customRes.status).toBe(200);
    await expect(customRes.json()).resolves.toMatchObject({
      title: 'Architecture Q&A',
      user_id: 'test-admin'
    });
  });

  test('PATCH, GET messages, and DELETE enforce conversation ownership', async ({
    server,
    auth,
    seeded
  }) => {
    const patchOwnRes = await fetch(
      `${server.baseUrl}/api/default/ai/conversations/${seeded.conversationId}`,
      {
        method: 'PATCH',
        headers: headers(auth),
        body: JSON.stringify({ title: 'Renamed conversation' })
      }
    );
    expect(patchOwnRes.status).toBe(200);
    await expect(patchOwnRes.json()).resolves.toMatchObject({
      id: seeded.conversationId,
      title: 'Renamed conversation'
    });

    const ownMessagesRes = await fetch(
      `${server.baseUrl}/api/default/ai/conversations/${seeded.conversationId}/messages`,
      {
        headers: { Authorization: auth }
      }
    );
    expect(ownMessagesRes.status).toBe(200);
    await expect(ownMessagesRes.json()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conversation_id: seeded.conversationId,
          content: 'Existing assistant message'
        })
      ])
    );

    const forbiddenPatchRes = await fetch(
      `${server.baseUrl}/api/default/ai/conversations/${seeded.otherConversationId}`,
      {
        method: 'PATCH',
        headers: headers(auth),
        body: JSON.stringify({ title: 'Nope' })
      }
    );
    expect(forbiddenPatchRes.status).toBe(403);

    const forbiddenMessagesRes = await fetch(
      `${server.baseUrl}/api/default/ai/conversations/${seeded.otherConversationId}/messages`,
      {
        headers: { Authorization: auth }
      }
    );
    expect(forbiddenMessagesRes.status).toBe(403);
  });

  test('DELETE /api/:workspace/ai/conversations/:conversationId deletes an owned conversation', async ({
    server,
    auth,
    seeded: _
  }) => {
    const createRes = await fetch(`${server.baseUrl}/api/default/ai/conversations`, {
      method: 'POST',
      headers: headers(auth),
      body: JSON.stringify({ title: 'Disposable conversation' })
    });
    expect(createRes.status).toBe(200);
    const created = (await createRes.json()) as Record<string, unknown>;

    const deleteRes = await fetch(
      `${server.baseUrl}/api/default/ai/conversations/${created['id']}`,
      {
        method: 'DELETE',
        headers: { Authorization: auth }
      }
    );
    expect(deleteRes.status).toBe(200);
    await expect(deleteRes.json()).resolves.toMatchObject({
      id: created['id'],
      title: 'Disposable conversation'
    });
  });

  test('GET and PUT /api/:workspace/ai/config shape and update AI config', async ({
    server,
    auth,
    seeded: _
  }) => {
    const getRes = await fetch(`${server.baseUrl}/api/default/ai/config`, {
      headers: { Authorization: auth }
    });
    expect(getRes.status).toBe(200);
    await expect(getRes.json()).resolves.toMatchObject({
      workspace: 'default',
      provider: 'openai',
      model: 'gpt-test',
      enabled: true,
      has_api_key: true
    });

    const putRes = await fetch(`${server.baseUrl}/api/default/ai/config`, {
      method: 'PUT',
      headers: headers(auth),
      body: JSON.stringify({
        provider: 'openrouter',
        api_key: null,
        model: 'router-model',
        base_url: 'http://mock-router',
        temperature: 0.8,
        system_prompt: 'Use bullets',
        enabled: false
      })
    });
    expect(putRes.status).toBe(200);
    await expect(putRes.json()).resolves.toMatchObject({
      workspace: 'default',
      provider: 'openrouter',
      model: 'router-model',
      base_url: 'http://mock-router',
      temperature: 0.8,
      system_prompt: 'Use bullets',
      enabled: false,
      has_api_key: true
    });
  });

  test('GET /api/:workspace/ai/config returns the default empty config when unset', async ({
    server,
    auth,
    seeded: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/no-ai/ai/config`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      workspace: 'no-ai',
      provider: 'openrouter',
      base_url: null,
      model: null,
      temperature: null,
      system_prompt: null,
      enabled: false,
      has_api_key: false,
      created_at: null,
      updated_at: null
    });
  });

  test('POST /api/:workspace/ai/chat streams a reply and persists conversation messages', async ({
    server,
    auth,
    seeded: _
  }) => {
    const createConversationRes = await fetch(`${server.baseUrl}/api/default/ai/conversations`, {
      method: 'POST',
      headers: headers(auth),
      body: JSON.stringify({ title: 'New conversation' })
    });
    expect(createConversationRes.status).toBe(200);
    const createdConversation = (await createConversationRes.json()) as Record<string, unknown>;
    const conversationId = String(createdConversation['id']);

    const prompt =
      'Explain the authentication flow between the frontend, API gateway, and auth service clearly.';

    const res = await fetch(`${server.baseUrl}/api/default/ai/chat`, {
      method: 'POST',
      headers: headers(auth),
      body: JSON.stringify({
        threadId: 'thread-1',
        runId: 'run-1',
        state: null,
        tools: [],
        context: [],
        forwardedProps: {
          conversationId
        },
        messages: [{ role: 'user', content: prompt }]
      })
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(await res.text()).toContain('Mock assistant');

    const messages = await server.db.ai.listMessages(conversationId);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: prompt
        }),
        expect.objectContaining({
          role: 'assistant',
          content: 'Mock assistant reply'
        })
      ])
    );

    const conversation = await server.db.ai.getConversation('default', conversationId);
    expect(conversation?.title).toBe('Explain the authentication flow between the fro...');
  });

  test('POST /api/:workspace/ai/chat validates auth, workspace, config, and request JSON', async ({
    server,
    auth,
    seeded: _
  }) => {
    const unauthRes = await fetch(`${server.baseUrl}/api/default/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    expect(unauthRes.status).toBe(401);

    const invalidJsonRes = await fetch(`${server.baseUrl}/api/default/ai/chat`, {
      method: 'POST',
      headers: headers(auth),
      body: 'not-json'
    });
    expect(invalidJsonRes.status).toBe(400);
    await expect(invalidJsonRes.json()).resolves.toMatchObject({
      message: 'Invalid JSON in request body'
    });

    const missingWsRes = await fetch(`${server.baseUrl}/api/missing/ai/chat`, {
      method: 'POST',
      headers: headers(auth),
      body: JSON.stringify({})
    });
    expect(missingWsRes.status).toBe(404);

    const noConfigRes = await fetch(`${server.baseUrl}/api/no-ai/ai/chat`, {
      method: 'POST',
      headers: headers(auth),
      body: JSON.stringify({
        threadId: 'thread-1',
        runId: 'run-1',
        state: null,
        tools: [],
        context: [],
        forwardedProps: {},
        messages: [{ role: 'user', content: 'hello' }]
      })
    });
    expect(noConfigRes.status).toBe(503);
  });

  test('POST /api/:workspace/ai/extract returns parsed entities from the mocked chat result', async ({
    server,
    auth,
    seeded: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/ai/extract`, {
      method: 'POST',
      headers: headers(auth),
      body: JSON.stringify({
        text: 'Customer Portal exposes a Billing API for account management.'
      })
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      entities: [
        {
          name: 'Billing API',
          schema_id: 'schema-api',
          fields: {
            system: 'Customer Portal'
          }
        }
      ]
    });
  });
});
