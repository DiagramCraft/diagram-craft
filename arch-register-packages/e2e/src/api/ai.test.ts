import { createServer } from 'node:http';
import { test as baseTest, expect } from '../helpers/fixtures';

type MockAIState = {
  baseUrl: string;
  requests: Array<Record<string, unknown>>;
  stop: () => Promise<void>;
};

const startMockAIProvider = async (): Promise<MockAIState> => {
  const requests: Array<Record<string, unknown>> = [];

  const server = createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
      res.statusCode = 404;
      res.end('not found');
      return;
    }

    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
      requests.push(body);
      const messages = Array.isArray(body['messages']) ? body['messages'] : [];
      const lastMessage = messages[messages.length - 1] as { content?: string } | undefined;
      const content = lastMessage?.content ?? '';

      if (content === 'rate-limit') {
        res.statusCode = 429;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ error: { message: 'Provider rate limited this request' } }));
        return;
      }

      if (body['stream'] !== false) {
        res.statusCode = 200;
        res.setHeader('content-type', 'text/event-stream');
        res.end('data: {"choices":[{"delta":{"content":"streamed reply"}}]}\n\n');
        return;
      }

      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          id: 'mock-response',
          choices: [
            {
              message: {
                role: 'assistant',
                content: `echo:${content}`
              }
            }
          ]
        })
      );
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });

  const port = (server.address() as { port: number }).port;
  return {
    baseUrl: `http://127.0.0.1:${port}/v1/chat/completions`,
    requests,
    stop: async () => {
      await new Promise<void>((resolve, reject) =>
        server.close(err => (err ? reject(err) : resolve()))
      );
    }
  };
};

const test = baseTest.extend<{ mockAI: MockAIState }>({
  mockAI: [
    async ({ server }, use) => {
      const mockAI = await startMockAIProvider();
      await server.db.ai.upsertAiConfig('default', {
        provider: 'openai',
        api_key_enc: 'test-api-key',
        base_url: mockAI.baseUrl,
        model: 'gpt-test',
        temperature: 0.2,
        enabled: true
      });
      await server.db.workspaceAdmin.createWorkspace({
        id: 'no-ai',
        name: 'No AI Workspace',
        url_slug: 'no-ai',
        short_code: 'NA',
        color: '',
        description: '',
        created_at: new Date('2026-06-07T10:00:00.000Z'),
        updated_at: new Date('2026-06-07T10:00:00.000Z')
      });
      await use(mockAI);
      await mockAI.stop();
    },
    { scope: 'file' }
  ]
});

const headers = (auth: string, contentType = 'application/json') => ({
  Authorization: auth,
  'Content-Type': contentType
});

test.describe('ai routes', () => {
  test('POST /api/:workspace/ai/generate returns JSON output from the mock provider', async ({
    server,
    auth,
    mockAI
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/ai/generate`, {
      method: 'POST',
      headers: headers(auth),
      body: JSON.stringify({
        stream: false,
        temperature: 0.4,
        max_tokens: 50,
        messages: [{ role: 'user', content: 'hello' }]
      })
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      choices: [{ message: { role: 'assistant', content: 'echo:hello' } }]
    });
    expect(mockAI.requests.at(-1)).toMatchObject({
      model: 'gpt-test',
      stream: false,
      temperature: 0.4,
      max_tokens: 50,
      messages: [{ role: 'user', content: 'hello' }]
    });
  });

  test('POST /api/:workspace/ai/generate proxies streaming responses', async ({
    server,
    auth,
    mockAI: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/ai/generate`, {
      method: 'POST',
      headers: headers(auth),
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'stream please' }]
      })
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(await res.text()).toContain('streamed reply');
  });

  test('POST /api/:workspace/ai/generate returns 401 without authentication', async ({
    server,
    mockAI: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hello' }]
      })
    });

    expect(res.status).toBe(401);
  });

  test('POST /api/:workspace/ai/generate returns 404 for unknown workspaces', async ({
    server,
    auth,
    mockAI: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/missing/ai/generate`, {
      method: 'POST',
      headers: headers(auth),
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hello' }]
      })
    });

    expect(res.status).toBe(404);
  });

  test('POST /api/:workspace/ai/generate returns 503 when AI is not configured', async ({
    server,
    auth,
    mockAI: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/no-ai/ai/generate`, {
      method: 'POST',
      headers: headers(auth),
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hello' }]
      })
    });

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      message: 'AI is not configured for this workspace'
    });
  });

  test('POST /api/:workspace/ai/generate returns 415 for non-JSON content types', async ({
    server,
    auth,
    mockAI: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/ai/generate`, {
      method: 'POST',
      headers: headers(auth, 'text/plain'),
      body: 'hello'
    });

    expect(res.status).toBe(415);
    await expect(res.json()).resolves.toMatchObject({
      message: 'Content-Type must be application/json'
    });
  });

  test('POST /api/:workspace/ai/generate returns 413 for oversized requests', async ({
    server,
    auth,
    mockAI: _
  }) => {
    const largeBody = JSON.stringify({
      messages: [{ role: 'user', content: 'x'.repeat(1024 * 1024) }]
    });

    const res = await fetch(`${server.baseUrl}/api/default/ai/generate`, {
      method: 'POST',
      headers: headers(auth),
      body: largeBody
    });

    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toMatchObject({
      message: 'Request size exceeds limit of 1048576 bytes'
    });
  });

  test('POST /api/:workspace/ai/generate validates request bodies', async ({
    server,
    auth,
    mockAI: _
  }) => {
    const invalidJsonRes = await fetch(`${server.baseUrl}/api/default/ai/generate`, {
      method: 'POST',
      headers: headers(auth),
      body: 'not-json'
    });
    expect(invalidJsonRes.status).toBe(400);

    const invalidMessagesRes = await fetch(`${server.baseUrl}/api/default/ai/generate`, {
      method: 'POST',
      headers: headers(auth),
      body: JSON.stringify({ messages: [] })
    });
    expect(invalidMessagesRes.status).toBe(400);
    await expect(invalidMessagesRes.json()).resolves.toMatchObject({
      message: 'messages array is required and must not be empty'
    });

    const invalidRoleRes = await fetch(`${server.baseUrl}/api/default/ai/generate`, {
      method: 'POST',
      headers: headers(auth),
      body: JSON.stringify({
        messages: [{ role: 'tool', content: 'nope' }]
      })
    });
    expect(invalidRoleRes.status).toBe(400);
    await expect(invalidRoleRes.json()).resolves.toMatchObject({
      message: 'Message role must be system, user, or assistant'
    });
  });

  test('POST /api/:workspace/ai/generate passes through provider HTTP errors', async ({
    server,
    auth,
    mockAI: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/ai/generate`, {
      method: 'POST',
      headers: headers(auth),
      body: JSON.stringify({
        stream: false,
        messages: [{ role: 'user', content: 'rate-limit' }]
      })
    });

    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toMatchObject({
      message: 'Provider rate limited this request'
    });
  });
});
