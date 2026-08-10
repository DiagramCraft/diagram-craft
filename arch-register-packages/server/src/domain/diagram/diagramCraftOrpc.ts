import { defineHandler, HTTPError } from 'h3';
import { implement, ORPCError } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { diagramCraftContract } from '@arch-register/api-types/diagramCraftContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import {
  buildApiEntityAuthCtx,
  filterVisibleEntities,
  requireWorkspaceCapability
} from '../auth/authorization';
import {
  orpcErrorInterceptors,
  orpcErrorMiddleware,
  workspaceScoped
} from '../../utils/orpcErrors';
import { resolveAiConfig } from '../ai/tanstackAiAdapter';
import { ConfiguredAIServer } from '../ai/configuredAiServer';
import type { AIGenerateRequest } from '../ai/aiServer';
import { toDiagramCraftData, toDiagramCraftSchema } from './diagramCraftTransforms';
import { toDiagramCraftRelationReferences } from './diagramCraftTransforms';
import { listAllCatalogEntities } from '../catalog/entityLoader';
import { ENTITY_DEFAULTS } from '../../constants';
import { buildEntityViewPermissionScope } from '../catalog/db/entityPermissionScope';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const diagramCraftRouter = implement(diagramCraftContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware)
  .use(workspaceScoped);

export const createDiagramCraftORPCRouter = () => {
  return diagramCraftRouter.router({
    diagramCraft: {
      getSchemas: diagramCraftRouter.diagramCraft.getSchemas.handler(async ({ context }) => {
        const { workspace, authCtx } = context;
        requireWorkspaceCapability(authCtx, 'ws.view');

        const [schemas, enums, relationSchemas] = await Promise.all([
          context.db.catalog.listSchemas(workspace),
          context.db.catalog.listEnums(workspace),
          context.db.relation.listRelationSchemas(workspace)
        ]);
        return schemas.map(schema => toDiagramCraftSchema(schema, enums, relationSchemas));
      }),

      getData: diagramCraftRouter.diagramCraft.getData.handler(async ({ context }) => {
        const { workspace, authCtx } = context;
        requireWorkspaceCapability(authCtx, 'ws.view');

        const entityAuthCtx = await buildApiEntityAuthCtx(context.db, workspace, context.event);
        const [allEntities, schemas] = await Promise.all([
          listAllCatalogEntities(context.db, workspace, {
            permissionScope: buildEntityViewPermissionScope(entityAuthCtx)
          }),
          context.db.catalog.listSchemas(workspace)
        ]);
        const schemaById = new Map(schemas.map(schema => [schema.id, schema]));
        const entities = filterVisibleEntities(entityAuthCtx, allEntities);
        const visibleEntityIds = new Set(entities.map(entity => entity.id));
        const relationRows = [];
        let relationOffset = 0;
        while (true) {
          const page = await context.db.relation.listRelations(
            workspace,
            {},
            { limit: ENTITY_DEFAULTS.PAGE_SIZE, offset: relationOffset }
          );
          relationRows.push(...page.items);
          if (page.items.length < ENTITY_DEFAULTS.PAGE_SIZE || relationRows.length >= page.total) {
            break;
          }
          relationOffset += ENTITY_DEFAULTS.PAGE_SIZE;
        }
        const relationReferences = toDiagramCraftRelationReferences(
          relationRows.filter(
            row => visibleEntityIds.has(row.in_entity_id) && visibleEntityIds.has(row.out_entity_id)
          ),
          entities,
          schemas,
          entityAuthCtx
        );
        return entities.map(entity =>
          toDiagramCraftData(
            entity,
            schemaById.get(entity.schema_id) ?? null,
            entityAuthCtx,
            relationReferences.get(entity.id)
          )
        );
      }),

      generate: diagramCraftRouter.diagramCraft.generate.handler(async ({ input, context }) => {
        const { workspace, authCtx } = context;
        requireWorkspaceCapability(authCtx, 'ws.view');

        const aiConfig = await resolveAiConfig(context.db, workspace);
        if (!aiConfig) {
          throw new ORPCError('SERVICE_UNAVAILABLE', {
            message: 'AI is not configured for this workspace'
          });
        }

        const aiServer = new ConfiguredAIServer(aiConfig);
        const result = await aiServer.generate(input.body as AIGenerateRequest);

        if (result.type === 'stream') {
          const reader = result.body.getReader();
          return (async function* () {
            const decoder = new TextDecoder();
            let buffer = '';
            try {
              while (true) {
                const chunk = await reader.read();
                if (chunk.done) return;

                buffer += decoder.decode(chunk.value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                  if (!line.trim() || !line.startsWith('data: ')) continue;
                  const data = line.slice(6);
                  if (data === '[DONE]') return;
                  try {
                    yield JSON.parse(data);
                  } catch {
                    // skip malformed lines
                  }
                }
              }
            } finally {
              reader.releaseLock();
            }
          })();
        }

        return (async function* () {
          yield result.body;
        })();
      })
    }
  });
};

const MAX_REQUEST_SIZE = 1 * 1024 * 1024;

export const createDiagramCraftORPCHandler = (db: DatabaseAdapter) => {
  const diagramCraftOpenAPIHandler = new OpenAPIHandler(createDiagramCraftORPCRouter(), {
    clientInterceptors: orpcErrorInterceptors
  });

  return defineHandler(async event => {
    const contentLength = parseInt(event.req.headers.get('content-length') ?? '0', 10);
    if (contentLength > MAX_REQUEST_SIZE) {
      throw new HTTPError({
        status: 413,
        statusText: 'Payload Too Large',
        message: `Request size exceeds limit of ${MAX_REQUEST_SIZE} bytes`
      });
    }

    const result = await diagramCraftOpenAPIHandler.handle(event.req, {
      prefix: '/api',
      context: { db, event: event as AuthenticatedEvent }
    });
    if (result.matched) return result.response;
  });
};
