import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter } from '../../storage/storage';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { toORPCError, orpcErrorInterceptors } from '../../utils/orpcErrors';
import {
  listWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace
} from './workspaceOperations';
import { SCHEMA_TEMPLATES } from '../catalog/schemaTemplates';
import { workspaceManagementContract } from '@arch-register/api-types/workspaceContract';

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
    }),
    templates: wsRouter.workspaces.templates.handler(async () => {
      try {
        return SCHEMA_TEMPLATES.map(({ id, name, description }) => ({ id, name, description }));
      } catch (error) {
        return toORPCError(error);
      }
    })
  }
});

export const workspaceManagementOpenAPIHandler = new OpenAPIHandler(workspaceManagementORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createWorkspaceManagementORPCHandler = (
  db: DatabaseAdapter,
  storage?: StorageAdapter
) =>
  defineHandler(async event => {
    const result = await workspaceManagementOpenAPIHandler.handle(event.req, {
      prefix: '/api',
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
