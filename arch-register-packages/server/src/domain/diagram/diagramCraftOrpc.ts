import { defineHandler } from 'h3';
import { implement, ORPCError } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { diagramCraftContract } from '@arch-register/api-types/diagramCraftContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { toORPCError, orpcErrorInterceptors } from '../../utils/orpcErrors';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization';
import { resolveAiConfig } from '../ai/tanstackAiAdapter';
import { ConfiguredAIServer } from '../ai/configuredAiServer';
import type { AIGenerateRequest } from '../ai/aiServer';
import { toDiagramCraftData, toDiagramCraftSchema } from './diagramCraftTransforms';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const diagramCraftRouter = implement(diagramCraftContract).$context<ORPCContext>();

export const createDiagramCraftORPCRouter = () => {
  return diagramCraftRouter.router({
    diagramCraft: {
      getSchemas: diagramCraftRouter.diagramCraft.getSchemas.handler(async ({ input, context }) => {
        try {
          const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
          const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
          requireWorkspaceCapability(authCtx, 'ws.view');

          const [schemas, enums] = await Promise.all([
            context.db.catalog.listSchemas(workspace),
            context.db.catalog.listEnums(workspace)
          ]);
          return schemas.map(schema => toDiagramCraftSchema(schema, enums));
        } catch (error) {
          throw toORPCError(error);
        }
      }),

      getData: diagramCraftRouter.diagramCraft.getData.handler(async ({ input, context }) => {
        try {
          const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
          const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
          requireWorkspaceCapability(authCtx, 'ws.view');

          const entities = await context.db.catalog.listEntities(workspace);
          return entities.map(entity => toDiagramCraftData(entity));
        } catch (error) {
          throw toORPCError(error);
        }
      }),

      generate: diagramCraftRouter.diagramCraft.generate.handler(async ({ input, context }) => {
        try {
          const workspace = await resolveWorkspace(context.db.catalog, input.params.workspace);
          const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
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
              try {
                while (true) {
                  const chunk = await reader.read();
                  const string = String.fromCharCode.apply(null, chunk.value);
                  if (chunk.done) {
                    return;
                  }

                  yield string;
                }
              } finally {
                reader.releaseLock();
              }
            })();
          }

          return (async function* () {
            yield result.body;
          })();
        } catch (error) {
          throw toORPCError(error);
        }
      })
    }
  });
};

export const createDiagramCraftORPCHandler = (db: DatabaseAdapter) => {
  const diagramCraftOpenAPIHandler = new OpenAPIHandler(createDiagramCraftORPCRouter(), {
    clientInterceptors: orpcErrorInterceptors
  });

  return defineHandler(async event => {
    const result = await diagramCraftOpenAPIHandler.handle(event.req, {
      prefix: '/api',
      context: { db, event: event as AuthenticatedEvent }
    });
    if (result.matched) return result.response;
  });
};
