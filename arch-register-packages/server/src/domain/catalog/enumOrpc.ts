import { HTTPError, defineHandler } from 'h3';
import { implement, ORPCError } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { workspaceEnumContract } from '@arch-register/api-types';
import type { DatabaseAdapter } from '../../db/database';
import { buildApiAuthCtx, requireWorkspaceCapability } from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import {
  createWorkspaceEnum,
  deleteWorkspaceEnum,
  getWorkspaceEnum,
  listWorkspaceEnums,
  updateWorkspaceEnum
} from './enumOperations';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const toORPCError = (error: unknown): never => {
  if (error instanceof ORPCError) throw error;

  if (HTTPError.isError(error)) {
    switch (error.status) {
      case 400:
        throw new ORPCError('BAD_REQUEST', { message: error.message });
      case 401:
        throw new ORPCError('UNAUTHORIZED', { message: error.message });
      case 403:
        throw new ORPCError('FORBIDDEN', { message: error.message });
      case 404:
        throw new ORPCError('NOT_FOUND', { message: error.message });
      case 409:
        throw new ORPCError('CONFLICT', { message: error.message });
      default:
        throw new ORPCError('INTERNAL_SERVER_ERROR', { message: error.message });
    }
  }

  throw new ORPCError('INTERNAL_SERVER_ERROR', { message: 'Internal Server Error' });
};

const enumRouter = implement(workspaceEnumContract).$context<ORPCContext>();

export const workspaceEnumORPCRouter = enumRouter.router({
  enums: {
    list: enumRouter.enums.list.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'ws.view');
        return await listWorkspaceEnums(context.db, workspace);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    get: enumRouter.enums.get.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'ws.view');
        return await getWorkspaceEnum(context.db, workspace, input.id);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    create: enumRouter.enums.create.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'schema.edit');
        return await createWorkspaceEnum(context.db, workspace, input);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    update: enumRouter.enums.update.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'schema.edit');
        return await updateWorkspaceEnum(context.db, workspace, input.id, input);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    remove: enumRouter.enums.remove.handler(async ({ input, context }) => {
      try {
        const workspace = await resolveWorkspace(context.db.catalog, input.workspace);
        const authCtx = await buildApiAuthCtx(context.db, workspace, context.event);
        requireWorkspaceCapability(authCtx, 'schema.edit');
        return await deleteWorkspaceEnum(context.db, workspace, input.id);
      } catch (error) {
        return toORPCError(error);
      }
    })
  }
});

export const workspaceEnumOpenAPIHandler = new OpenAPIHandler(workspaceEnumORPCRouter);

let generatedEnumOpenAPISpec: Promise<object> | null = null;

export const getWorkspaceEnumOpenAPISpec = () => {
  generatedEnumOpenAPISpec ??= new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()]
  }).generate(workspaceEnumContract, {
    info: {
      title: 'Arch Register Enum POC API',
      version: '1.0.0'
    },
    servers: [{ url: 'http://localhost:3010/api/poc-orpc' }]
  });

  return generatedEnumOpenAPISpec;
};

export const createWorkspaceEnumOpenAPISpecHandler = () =>
  defineHandler(async () => Response.json(await getWorkspaceEnumOpenAPISpec()));

export const createWorkspaceEnumORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await workspaceEnumOpenAPIHandler.handle(event.req, {
      prefix: '/api/poc-orpc',
      context: {
        db,
        event: event as AuthenticatedEvent
      }
    });

    if (result.matched) {
      return result.response;
    }
  });
