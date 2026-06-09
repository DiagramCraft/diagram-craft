import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { workspaceManagementContract } from '@arch-register/api-types';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { toORPCError } from '../../utils/orpcErrors';
import {
  listWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace
} from './workspaceOperations';

type ORPCContext = {
  db: DatabaseAdapter;
  storage: StorageAdapter | undefined;
  event: AuthenticatedEvent;
};

const wsRouter = implement(workspaceManagementContract).$context<ORPCContext>();

export const workspaceManagementORPCRouter = wsRouter.router({
  workspaces: {
    list: wsRouter.workspaces.list.handler(async ({ context }) => {
      try {
        return await listWorkspaces(context.db);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    create: wsRouter.workspaces.create.handler(async ({ input, context }) => {
      try {
        return await createWorkspace(context.db, input, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    update: wsRouter.workspaces.update.handler(async ({ input, context }) => {
      try {
        return await updateWorkspace(context.db, input.id, input, context.event);
      } catch (error) {
        return toORPCError(error);
      }
    }),
    remove: wsRouter.workspaces.remove.handler(async ({ input, context }) => {
      try {
        return await deleteWorkspace(context.db, input.id, context.event, context.storage);
      } catch (error) {
        return toORPCError(error);
      }
    })
  }
});

export const workspaceManagementOpenAPIHandler = new OpenAPIHandler(workspaceManagementORPCRouter);

let generatedWorkspaceOpenAPISpec: Promise<object> | null = null;

export const getWorkspaceManagementOpenAPISpec = () => {
  generatedWorkspaceOpenAPISpec ??= new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()]
  }).generate(workspaceManagementContract, {
    info: {
      title: 'Arch Register Workspace POC API',
      version: '1.0.0'
    },
    servers: [{ url: 'http://localhost:3010/api/poc-orpc' }]
  });

  return generatedWorkspaceOpenAPISpec;
};

export const createWorkspaceManagementOpenAPISpecHandler = () =>
  defineHandler(async () => Response.json(await getWorkspaceManagementOpenAPISpec()));

export const createWorkspaceManagementORPCHandler = (
  db: DatabaseAdapter,
  storage?: StorageAdapter
) =>
  defineHandler(async event => {
    const result = await workspaceManagementOpenAPIHandler.handle(event.req, {
      prefix: '/api/poc-orpc',
      context: {
        db,
        storage,
        event: event as AuthenticatedEvent
      }
    });

    if (result.matched) {
      return result.response;
    }
  });
