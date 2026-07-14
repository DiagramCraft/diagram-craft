#!/usr/bin/env node
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createApiClient } from './apiClient';
import { createMcpServer } from './tools';

const requiredEnv = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const mutationsEnabled = () => process.env['MCP_ENABLE_MUTATIONS'] === 'true';

const createApi = (token: string) =>
  createApiClient({
    baseUrl: requiredEnv('ARCH_REGISTER_URL'),
    workspace: requiredEnv('ARCH_REGISTER_WORKSPACE'),
    token
  });

const isApiToken = (token: string) => token.startsWith('ar_pat_');

const requestToken = (request: IncomingMessage) => {
  const value = request.headers.authorization;
  if (!value?.startsWith('Bearer ')) return null;
  const token = value.slice('Bearer '.length).trim();
  return isApiToken(token) ? token : null;
};

const readJsonBody = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new Error('Request body is too large');
    chunks.push(buffer);
  }
  if (chunks.length === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const jsonError = (response: ServerResponse, status: number, message: string) => {
  if (response.headersSent) return;
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: message }));
};

const addCorsHeaders = (response: ServerResponse) => {
  response.setHeader('access-control-allow-origin', process.env['MCP_CORS_ORIGIN'] ?? '*');
  response.setHeader('access-control-allow-headers', 'authorization, content-type, mcp-session-id');
  response.setHeader('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS');
  response.setHeader('access-control-expose-headers', 'Mcp-Session-Id');
};

const runStdio = async () => {
  const api = createApi(requiredEnv('ARCH_REGISTER_TOKEN'));
  const server = createMcpServer({ api, enableMutations: mutationsEnabled() });
  await server.connect(new StdioServerTransport());
};

type SseSession = {
  token: string;
  server: ReturnType<typeof createMcpServer>;
  transport: SSEServerTransport;
};

const runHttp = async () => {
  const sessions = new Map<string, SseSession>();
  const port = Number(process.env['MCP_PORT'] ?? 3030);
  const host = process.env['MCP_HOST'] ?? '127.0.0.1';

  const server = createServer(async (request, response) => {
    addCorsHeaders(response);
    if (request.method === 'OPTIONS') {
      response.writeHead(204).end();
      return;
    }

    if (request.url === '/mcp' && request.method === 'POST') {
      const token = requestToken(request);
      if (!token) {
        jsonError(response, 401, 'A workspace API token is required');
        return;
      }

      try {
        const api = createApi(token);
        const mcpServer = createMcpServer({ api, enableMutations: mutationsEnabled() });
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        await mcpServer.connect(transport);
        await transport.handleRequest(request, response, await readJsonBody(request));
        response.on('close', () => {
          void transport.close();
          void mcpServer.close();
        });
      } catch (error) {
        jsonError(response, 500, error instanceof Error ? error.message : 'MCP request failed');
      }
      return;
    }

    if (request.url === '/mcp') {
      jsonError(response, 405, 'Use POST /mcp for Streamable HTTP MCP requests');
      return;
    }

    if (request.url === '/sse' && request.method === 'GET') {
      const token = requestToken(request);
      if (!token) {
        jsonError(response, 401, 'A workspace API token is required');
        return;
      }

      try {
        const transport = new SSEServerTransport('/messages', response);
        const mcpServer = createMcpServer({
          api: createApi(token),
          enableMutations: mutationsEnabled()
        });
        const sessionId = transport.sessionId;
        sessions.set(sessionId, { token, server: mcpServer, transport });
        transport.onclose = () => {
          sessions.delete(sessionId);
          void mcpServer.close();
        };
        await mcpServer.connect(transport);
      } catch (error) {
        jsonError(response, 500, error instanceof Error ? error.message : 'SSE setup failed');
      }
      return;
    }

    if (request.url?.startsWith('/messages') && request.method === 'POST') {
      const sessionId = new URL(
        request.url,
        `http://${request.headers.host ?? 'localhost'}`
      ).searchParams.get('sessionId');
      const session = sessionId ? sessions.get(sessionId) : undefined;
      const token = requestToken(request);
      if (!session || !token || token !== session.token) {
        jsonError(response, 401, 'Invalid or missing SSE session credentials');
        return;
      }
      try {
        await session.transport.handlePostMessage(request, response, await readJsonBody(request));
      } catch (error) {
        jsonError(response, 500, error instanceof Error ? error.message : 'SSE request failed');
      }
      return;
    }

    jsonError(response, 404, 'Not found');
  });

  server.listen(port, host, () => {
    process.stderr.write(`Arch Register MCP server listening on http://${host}:${port}\n`);
  });

  const shutdown = async () => {
    for (const session of sessions.values()) {
      await session.transport.close();
      await session.server.close();
    }
    await new Promise<void>(resolve => server.close(() => resolve()));
  };
  process.once('SIGINT', () => void shutdown().then(() => process.exit(0)));
  process.once('SIGTERM', () => void shutdown().then(() => process.exit(0)));
};

const main = async () => {
  if (process.argv.includes('--http') || process.env['MCP_TRANSPORT'] === 'http') {
    await runHttp();
  } else {
    await runStdio();
  }
};

main().catch(error => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  );
  process.exitCode = 1;
});
