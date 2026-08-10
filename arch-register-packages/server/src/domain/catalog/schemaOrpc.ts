import { implement } from '@orpc/server';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { API_PREFIXES } from '../../constants';
import { orpcErrorMiddleware } from '../../utils/orpcErrors';
import {
  listWorkspaceSchemas,
  getWorkspaceSchema,
  createWorkspaceSchema,
  updateWorkspaceSchema,
  deleteWorkspaceSchema,
  listWorkspaceSchemaVersions,
  previewWorkspaceSchemaValidation
} from './schemaOperations';
import { workspaceSchemaContract } from '@arch-register/api-types/schemaContract';
import { requestForApiSurface } from '../../utils/apiRouteAliases';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const schemaRouter = implement(workspaceSchemaContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware);

export const workspaceSchemaORPCRouter = schemaRouter.router({
  schemas: {
    list: schemaRouter.schemas.list.handler(async ({ input, context }) => {
      return await listWorkspaceSchemas(context.db, input.params.workspace, context.event);
    }),
    get: schemaRouter.schemas.get.handler(async ({ input, context }) => {
      return await getWorkspaceSchema(
        context.db,
        input.params.workspace,
        input.params.id,
        context.event
      );
    }),
    create: schemaRouter.schemas.create.handler(async ({ input, context }) => {
      return await createWorkspaceSchema(
        context.db,
        input.params.workspace,
        input.body,
        context.event
      );
    }),
    update: schemaRouter.schemas.update.handler(async ({ input, context }) => {
      return await updateWorkspaceSchema(
        context.db,
        input.params.workspace,
        input.params.id,
        input.body,
        context.event
      );
    }),
    previewValidation: schemaRouter.schemas.previewValidation.handler(async ({ input, context }) =>
      previewWorkspaceSchemaValidation(
        context.db,
        input.params.workspace,
        input.params.id,
        input.body,
        context.event
      )
    ),
    remove: schemaRouter.schemas.remove.handler(async ({ input, context }) => {
      return await deleteWorkspaceSchema(
        context.db,
        input.params.workspace,
        input.params.id,
        context.event
      );
    }),
    listVersions: schemaRouter.schemas.listVersions.handler(async ({ input, context }) => {
      return await listWorkspaceSchemaVersions(
        context.db,
        input.params.workspace,
        input.params.id,
        context.event
      );
    })
  }
});

export const createWorkspaceSchemaORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(workspaceSchemaORPCRouter, {
    prefix: API_PREFIXES.root,
    shouldHandle: event => {
      const url = new URL(event.req.url);
      return (
        (event.req.method === 'GET' &&
          new RegExp(`^${API_PREFIXES.integrations}/[^/]+/schemas$`).test(url.pathname)) ||
        new RegExp(`^${API_PREFIXES.application}/[^/]+/schemas(?:/.*)?$`).test(url.pathname)
      );
    },
    request: event => {
      const url = new URL(event.req.url);
      const isIntegrationSchemaList =
        event.req.method === 'GET' &&
        new RegExp(`^${API_PREFIXES.integrations}/[^/]+/schemas$`).test(url.pathname);
      return requestForApiSurface(
        event,
        isIntegrationSchemaList ? API_PREFIXES.integrations : API_PREFIXES.application,
        API_PREFIXES.root
      );
    },
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
