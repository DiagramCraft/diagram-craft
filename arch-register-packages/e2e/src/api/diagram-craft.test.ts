import { createServer } from 'node:http';
import { createApiTest, expect } from '../helpers/fixtures';
import { seedCatalogEntities, seedIds } from '../helpers/seedHelper';

type MockAIState = {
  baseUrl: string;
  requests: Array<Record<string, unknown>>;
  stop: () => Promise<void>;
};

const componentSchemaId = '00000000-0000-0000-0000-000000000003';
const frontendAppId = '00000000-0000-0000-0003-000000000002';

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

const test = createApiTest().extend<{ mockAI: MockAIState }>({
  mockAI: [
    async ({ server }, use) => {
      await seedCatalogEntities(server.db);

      const mockAI = await startMockAIProvider();
      await server.db.ai.upsertAiConfig(seedIds.workspace.default, {
        provider: 'openai',
        api_key_enc: 'test-api-key',
        base_url: mockAI.baseUrl,
        model: 'gpt-test',
        temperature: 0.2,
        enabled: true
      });
      await server.db.workspace.createWorkspace({
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

test.describe('diagram craft routes', () => {
  test('GET /api/public/:workspace/schemas returns diagram craft schema shapes', async ({
    server,
    auth,
    mockAI: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/public/default/schemas`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: componentSchemaId,
          name: 'Component',
          fields: expect.arrayContaining([
            expect.objectContaining({ id: 'name', type: 'text' }),
            expect.objectContaining({ id: 'description', type: 'longtext' }),
            expect.objectContaining({ id: 'system', type: 'containment' }),
            expect.objectContaining({ id: 'depends_on', type: 'reference' })
          ])
        })
      ])
    );
  });

  test('GET /api/public/:workspace/data returns diagram craft entity data', async ({
    server,
    auth,
    mockAI: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/public/default/data`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _uid: frontendAppId,
          _schemaId: componentSchemaId,
          _name: 'Frontend App',
          _owner: seedIds.teams.design,
          name: 'Frontend App',
          description: 'React single-page application served to end users.',
          technology: 'React',
          system: '00000000-0000-0000-0002-000000000001'
        })
      ])
    );
  });

  test('POST /api/:workspace/ai/generate returns JSON output from the mock provider', async ({
    server,
    auth,
    mockAI
  }) => {
    const res = await fetch(`${server.baseUrl}/api/sse/default/ai/generate`, {
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
    const res = await fetch(`${server.baseUrl}/api/sse/default/ai/generate`, {
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

  test('diagram craft routes return 401 without authentication', async ({ server, mockAI: _ }) => {
    const publicRes = await fetch(`${server.baseUrl}/api/public/default/schemas`);
    expect(publicRes.status).toBe(401);

    const aiRes = await fetch(`${server.baseUrl}/api/sse/default/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hello' }]
      })
    });
    expect(aiRes.status).toBe(401);
  });

  test('diagram craft routes return 404 for unknown workspaces', async ({
    server,
    auth,
    mockAI: _
  }) => {
    const publicRes = await fetch(`${server.baseUrl}/api/public/nonexistent/data`, {
      headers: { Authorization: auth }
    });
    expect(publicRes.status).toBe(404);

    const aiRes = await fetch(`${server.baseUrl}/api/sse/missing/ai/generate`, {
      method: 'POST',
      headers: headers(auth),
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hello' }]
      })
    });
    expect(aiRes.status).toBe(404);
  });

  test('POST /api/:workspace/ai/generate returns 503 when AI is not configured', async ({
    server,
    auth,
    mockAI: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/sse/no-ai/ai/generate`, {
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

  test('POST /api/:workspace/ai/generate validates headers and body', async ({
    server,
    auth,
    mockAI: _
  }) => {
    const contentTypeRes = await fetch(`${server.baseUrl}/api/sse/default/ai/generate`, {
      method: 'POST',
      headers: headers(auth, 'text/plain'),
      body: 'hello'
    });
    expect(contentTypeRes.status).toBe(415);

    const oversizedBody = JSON.stringify({
      messages: [{ role: 'user', content: 'x'.repeat(1024 * 1024 + 32) }]
    });

    const oversizeRes = await fetch(`${server.baseUrl}/api/sse/default/ai/generate`, {
      method: 'POST',
      headers: headers(auth),
      body: oversizedBody
    });
    expect(oversizeRes.status).toBe(413);

    const invalidJsonRes = await fetch(`${server.baseUrl}/api/sse/default/ai/generate`, {
      method: 'POST',
      headers: headers(auth),
      body: JSON.stringify({})
    });
    expect(invalidJsonRes.status).toBe(400);
    await expect(invalidJsonRes.json()).resolves.toMatchObject({
      message: 'messages array is required and must not be empty'
    });
  });

  test('POST /api/:workspace/ai/generate passes through provider HTTP errors', async ({
    server,
    auth,
    mockAI: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/sse/default/ai/generate`, {
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
