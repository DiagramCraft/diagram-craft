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
import { createStorage } from './storage/storage.js';

const storage = createStorage();
const app = new H3();
const openApiSpecUrl = new URL('../openapi.yaml', import.meta.url);

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
app.use(createSearchRoutes());
app.use(createProjectRoutes(storage));
app.use(createAuditRoutes());
app.use(createWorkspaceConfigRoutes());

const server = createServer(toNodeListener(app));
const PORT = Number(process.env['PORT'] ?? 3010);

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
