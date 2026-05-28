import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { H3, defineHandler, handleCors, toNodeListener } from 'h3';
import { createDataRoutes } from './routes/data.js';
import { createProjectRoutes } from './routes/projects.js';
import { createSearchRoutes } from './routes/search.js';
import { createSchemaRoutes } from './routes/schemas.js';
import { createWorkspaceRoutes } from './routes/workspaces.js';
import { createAuditRoutes } from './routes/audit.js';
import { createWorkspaceConfigRoutes } from './routes/workspace-config.js';
import { createPublicRoutes } from './routes/public.js';
import { createStorage } from './storage/storage.js';
import { YjsCollaborationServer } from './collaboration/yjsCollaborationServer.js';
import { OpenRouterAIServer } from './ai/openRouterAiServer.js';
import { createAIRoutes } from './routes/ai.js';
import sql from './db/client.js';

const storage = createStorage();
const app = new H3();
const openApiSpecUrl = new URL('../openapi.yaml', import.meta.url);

// ── Auto-save writer ────────────────────────────────────────────────
// Room names follow the convention: <workspace>/<projectId>/<fileId>.json
// The writer persists serialized diagram content to storage and updates
// the project_file row in PostgreSQL.
const autoSaveWriter = async (relPath: string, content: string) => {
  const parts = relPath.split('/');
  if (parts.length < 3) {
    console.warn(`[AutoSave] Unexpected room path format: ${relPath}`);
    return;
  }

  const workspace = parts[0]!;
  const projectId = parts[1]!;
  let fileId = parts.slice(2).join('/');
  if (fileId.endsWith('.json')) fileId = fileId.slice(0, -5);

  const buf = Buffer.from(content, 'utf8');
  await storage.write(workspace, projectId, fileId, buf);
  await sql`UPDATE project_file SET size_bytes = ${buf.length} WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${fileId}`;
};

// ── Collaboration server ────────────────────────────────────────────
// Temp path maps to the same real path — every debounced write goes
// directly to the real storage location.
const collaborationServer = new YjsCollaborationServer(
  '/ws',
  autoSaveWriter,
  name => name
);

// CORS middleware
app.use(
  defineHandler(event => {
    const didHandleCors = handleCors(event, {
      origin: '*',
      preflight: { statusCode: 204 },
      methods: '*'
    });
    if (didHandleCors) return;
  })
);

// OpenAPI spec
app.use(
  '/openapi.yaml',
  defineHandler(async () => {
    const body = await readFile(openApiSpecUrl, 'utf8');
    return new Response(body, {
      headers: {
        'content-type': 'application/yaml; charset=utf-8'
      }
    });
  })
);

// API routes
app.use(createWorkspaceRoutes(storage));
app.use(createSchemaRoutes());
app.use(createDataRoutes());
app.use(createPublicRoutes());
app.use(createSearchRoutes());
app.use(createProjectRoutes(storage));
app.use(createAuditRoutes());
app.use(createWorkspaceConfigRoutes());

// ── AI routes (conditional on OPENROUTER_API_KEY) ───────────────────
const openrouterApiKey = process.env['OPENROUTER_API_KEY'];
if (openrouterApiKey) {
  const aiServer = new OpenRouterAIServer({
    apiKey: openrouterApiKey,
    defaultModel: process.env['OPENROUTER_MODEL'],
    appName: 'ArchRegister'
  });
  app.use(createAIRoutes(aiServer));
  console.log('AI routes enabled (OpenRouter)');
} else {
  console.log('AI routes disabled (set OPENROUTER_API_KEY to enable)');
}

// ── Start server ────────────────────────────────────────────────────
const server = createServer(toNodeListener(app));
collaborationServer.bind(server);

const PORT = Number(process.env['PORT'] ?? 3010);

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`WebSocket collaboration listening on ws://localhost:${PORT}/ws`);
});

// ── Graceful shutdown ───────────────────────────────────────────────
const shutdown = async () => {
  console.log('Shutting down...');
  await collaborationServer.close();
  server.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
