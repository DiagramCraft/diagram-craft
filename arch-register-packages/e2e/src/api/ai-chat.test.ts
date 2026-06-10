import { createApiTest, expect } from '../helpers/fixtures';
import { seedIds } from '../helpers/seedHelper';

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
        (data['messages'] as Array<{
          role: string;
          content?: unknown;
          parts?: Array<{ type?: string; content?: string }>;
        }>) ?? [],
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

const test = createApiTest({
  appOptions: {
    routeOverrides: {
      aiChat: mockAiChatOverrides as never
    }
  }
}).extend<{
  seeded: SeededFixtures;
}>({
  seeded: [
    async ({ server }, use) => {
      const now = new Date('2026-06-07T12:00:00.000Z');

      await server.db.ai.upsertAiConfig(seedIds.workspace.default, {
        provider: 'openai',
        api_key_enc: 'mock-api-key',
        model: 'gpt-test',
        temperature: 0.4,
        system_prompt: 'Be concise',
        enabled: true
      });

      await server.db.workspace.createWorkspace({
        id: 'no-ai',
        name: 'No AI Workspace',
        url_slug: 'no-ai',
        short_code: 'NA',
        color: '',
        description: '',
        created_at: now,
        updated_at: now
      });

      await server.db.auth.createUser({
        id: 'other-ai-user',
        user_id: 'other-ai-user',
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
        workspace: seedIds.workspace.default,
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
        workspace: seedIds.workspace.default,
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

test.describe('ai chat routes', () => {
  test('GET /api/:workspace/ai/conversations lists only the current user conversations', async ({
    orpc,
    seeded
  }) => {
    const body = await orpc.ai.listConversations({ params: { workspace: 'default' } });
    expect(body).toEqual([
      expect.objectContaining({
        id: seeded.conversationId,
        title: 'New conversation'
      })
    ]);
  });

  test('POST /api/:workspace/ai/conversations creates a conversation with default and explicit titles', async ({
    orpc,
    seeded: _
  }) => {
    const defaultResult = await orpc.ai.createConversation({
      params: { workspace: 'default' },
      body: {}
    });
    expect(defaultResult).toMatchObject({
      title: 'New conversation',
      user_id: 'test-admin'
    });

    const customResult = await orpc.ai.createConversation({
      params: { workspace: 'default' },
      body: { title: 'Architecture Q&A' }
    });
    expect(customResult).toMatchObject({
      title: 'Architecture Q&A',
      user_id: 'test-admin'
    });
  });

  test('PATCH, GET messages, and DELETE enforce conversation ownership', async ({
    orpc,
    seeded
  }) => {
    const patched = await orpc.ai.updateConversation({
      params: { workspace: 'default', id: seeded.conversationId },
      body: { title: 'Renamed conversation' }
    });
    expect(patched).toMatchObject({
      id: seeded.conversationId,
      title: 'Renamed conversation'
    });

    const messages = await orpc.ai.listMessages({
      params: { workspace: 'default', id: seeded.conversationId }
    });
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conversation_id: seeded.conversationId,
          content: 'Existing assistant message'
        })
      ])
    );

    await expect(
      orpc.ai.updateConversation({
        params: { workspace: 'default', id: seeded.otherConversationId },
        body: { title: 'Nope' }
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(
      orpc.ai.listMessages({
        params: { workspace: 'default', id: seeded.otherConversationId }
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  test('DELETE /api/:workspace/ai/conversations/:conversationId deletes an owned conversation', async ({
    orpc,
    seeded: _
  }) => {
    const created = await orpc.ai.createConversation({
      params: { workspace: 'default' },
      body: { title: 'Disposable conversation' }
    });

    const deleted = await orpc.ai.deleteConversation({
      params: { workspace: 'default', id: created.id }
    });
    expect(deleted).toMatchObject({
      id: created.id,
      title: 'Disposable conversation'
    });
  });

  test('GET and PUT /api/:workspace/ai/config shape and update AI config', async ({
    orpc,
    seeded: _
  }) => {
    const config = await orpc.ai.getConfig({ params: { workspace: 'default' } });
    expect(config).toMatchObject({
      workspace: seedIds.workspace.default,
      provider: 'openai',
      model: 'gpt-test',
      enabled: true,
      has_api_key: true
    });

    const updated = await orpc.ai.updateConfig({
      params: { workspace: 'default' },
      body: {
        provider: 'openrouter',
        api_key: null,
        model: 'router-model',
        base_url: 'http://mock-router',
        temperature: 0.8,
        system_prompt: 'Use bullets',
        enabled: false
      }
    });
    expect(updated).toMatchObject({
      workspace: seedIds.workspace.default,
      provider: 'openrouter',
      model: 'router-model',
      base_url: 'http://mock-router',
      temperature: 0.8,
      system_prompt: 'Use bullets',
      enabled: false,
      has_api_key: true
    });
  });

  test('GET /api/:workspace/ai/config returns 404 when unset', async ({
    orpc,
    seeded: _
  }) => {
    await expect(
      orpc.ai.getConfig({ params: { workspace: 'no-ai' } })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('POST /api/:workspace/ai/chat streams a reply and persists conversation messages', async ({
    server,
    auth,
    orpc,
    seeded: _
  }) => {
    const createdConversation = await orpc.ai.createConversation({
      params: { workspace: 'default' },
      body: { title: 'New conversation' }
    });
    const conversationId = createdConversation.id;

    const prompt =
      'Explain the authentication flow between the frontend, API gateway, and auth service clearly.';

    const res = await fetch(`${server.baseUrl}/api/sse/default/ai/chat`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
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

    const conversation = await server.db.ai.getConversation(
      seedIds.workspace.default,
      conversationId
    );
    expect(conversation?.title).toBe('Explain the authentication flow between the fro...');
  });

  test('POST /api/:workspace/ai/chat validates auth, workspace, config, and request JSON', async ({
    server,
    auth,
    seeded: _
  }) => {
    const unauthRes = await fetch(`${server.baseUrl}/api/sse/default/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    expect(unauthRes.status).toBe(401);

    const invalidJsonRes = await fetch(`${server.baseUrl}/api/sse/default/ai/chat`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: 'not-json'
    });
    expect(invalidJsonRes.status).toBe(400);
    await expect(invalidJsonRes.json()).resolves.toMatchObject({
      message: 'Invalid JSON in request body'
    });

    const missingWsRes = await fetch(`${server.baseUrl}/api/sse/missing/ai/chat`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    expect(missingWsRes.status).toBe(404);

    const noConfigRes = await fetch(`${server.baseUrl}/api/sse/no-ai/ai/chat`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
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
    orpc,
    seeded: _
  }) => {
    const result = await orpc.ai.extract({
      params: { workspace: 'default' },
      body: { text: 'Customer Portal exposes a Billing API for account management.' }
    });

    expect(result).toEqual({
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
